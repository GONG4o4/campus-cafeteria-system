// No-show tracking and ordering restrictions.
// All time checks use the database clock (CURRENT_TIMESTAMP), never the
// browser's clock, so the frontend cannot fake a deadline.

const TIME_FORMAT = `'YYYY-MM-DD"T"HH24:MI:SS'`;

async function getPolicy(db) {
    const result = await db.query(
        `SELECT pickup_window_minutes, grace_period_minutes, offense_threshold,
                offense_window_days, restriction_days, policy_version
         FROM no_show_policy
         WHERE policy_id = 1`
    );

    if (result.rows.length === 0) {
        throw new Error("No-show policy is not configured");
    }

    return result.rows[0];
}

// Returns the active restriction for a customer, or null.
// Expired restrictions (ends_at in the past) are ignored here,
// so they stop blocking orders automatically.
async function findActiveRestriction(db, userId) {
    const result = await db.query(
        `SELECT restriction_id, reason,
                TO_CHAR(starts_at, ${TIME_FORMAT}) AS starts_at,
                TO_CHAR(ends_at, ${TIME_FORMAT}) AS ends_at
         FROM customer_restrictions
         WHERE user_id = $1
           AND status = 'active'
           AND ends_at > CURRENT_TIMESTAMP
         ORDER BY ends_at DESC
         LIMIT 1`,
        [userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

// Warning until the customer reaches the threshold, then a restriction.
function decidePolicyResult(offenseCount, policy) {
    if (offenseCount >= policy.offense_threshold) {
        return "restricted";
    }

    return "warning";
}

// Marks a ready order as not collected. Must be called inside a transaction.
// Returns { error: { status, message } } when the order cannot be marked,
// or { order, no_show, restriction } when it worked.
async function markOrderNoShow(client, orderId, staffUserId) {
    const policy = await getPolicy(client);
    const deadlineMinutes = policy.pickup_window_minutes;
    const graceEndMinutes = policy.pickup_window_minutes + policy.grace_period_minutes;

    // FOR UPDATE locks the order so two staff clicking at the same time
    // cannot both record a no-show.
    const orderResult = await client.query(
        `SELECT order_id, user_id, queue_number, status,
                TO_CHAR(COALESCE(ready_at, updated_at) + make_interval(mins => $2), ${TIME_FORMAT}) AS pickup_deadline,
                TO_CHAR(COALESCE(ready_at, updated_at) + make_interval(mins => $3), ${TIME_FORMAT}) AS no_show_after,
                CURRENT_TIMESTAMP >= COALESCE(ready_at, updated_at) + make_interval(mins => $2) AS deadline_passed,
                CURRENT_TIMESTAMP >= COALESCE(ready_at, updated_at) + make_interval(mins => $3) AS grace_passed
         FROM orders
         WHERE order_id = $1
         FOR UPDATE`,
        [orderId, deadlineMinutes, graceEndMinutes]
    );

    if (orderResult.rows.length === 0) {
        return { error: { status: 404, message: "Order not found." } };
    }

    const order = orderResult.rows[0];

    if (order.status === "no_show") {
        return { error: { status: 409, message: "This order is already marked as a no-show." } };
    }

    if (order.status !== "ready") {
        return {
            error: {
                status: 409,
                message: `Only orders that are ready for pickup can be marked as a no-show. This order is ${order.status}.`
            }
        };
    }

    if (!order.deadline_passed) {
        return {
            error: {
                status: 409,
                message: "The pickup deadline has not passed yet.",
                no_show_after: order.no_show_after
            }
        };
    }

    if (!order.grace_passed) {
        return {
            error: {
                status: 409,
                message: "The grace period has not ended yet.",
                no_show_after: order.no_show_after
            }
        };
    }

    // Lock the customer row so two no-shows for the same customer
    // are counted one after the other (keeps the offense count correct).
    await client.query(
        "SELECT user_id FROM users WHERE user_id = $1 FOR UPDATE",
        [order.user_id]
    );

    const updated = await client.query(
        `UPDATE orders
         SET status = 'no_show',
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1
           AND status = 'ready'
         RETURNING order_id, queue_number, status`,
        [orderId]
    );

    if (updated.rows.length === 0) {
        return { error: { status: 409, message: "Order status changed. Refresh and try again." } };
    }

    const countResult = await client.query(
        `SELECT COUNT(*)::int AS total
         FROM no_show_records
         WHERE user_id = $1
           AND recorded_at >= CURRENT_TIMESTAMP - make_interval(days => $2)`,
        [order.user_id, policy.offense_window_days]
    );

    const offenseCount = countResult.rows[0].total + 1;
    const policyResult = decidePolicyResult(offenseCount, policy);

    // ON CONFLICT is a second safety net: the UNIQUE (order_id) rule means
    // one order can never get two no-show records.
    const recordResult = await client.query(
        `INSERT INTO no_show_records (order_id, user_id, recorded_by, offense_count, policy_result)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (order_id) DO NOTHING
         RETURNING no_show_id, TO_CHAR(recorded_at, ${TIME_FORMAT}) AS recorded_at`,
        [orderId, order.user_id, staffUserId, offenseCount, policyResult]
    );

    if (recordResult.rows.length === 0) {
        return { error: { status: 409, message: "This order is already marked as a no-show." } };
    }

    const noShow = {
        no_show_id: recordResult.rows[0].no_show_id,
        order_id: orderId,
        customer_id: order.user_id,
        recorded_by: staffUserId,
        recorded_at: recordResult.rows[0].recorded_at,
        offense_count: offenseCount,
        offense_threshold: policy.offense_threshold,
        offense_window_days: policy.offense_window_days,
        policy_result: policyResult
    };

    let restriction = null;

    if (policyResult === "restricted") {
        const reason = `${offenseCount} uncollected orders within ${policy.offense_window_days} days`;

        const restrictionResult = await client.query(
            `INSERT INTO customer_restrictions (user_id, no_show_id, reason, starts_at, ends_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + make_interval(days => $4))
             RETURNING restriction_id, reason,
                       TO_CHAR(starts_at, ${TIME_FORMAT}) AS starts_at,
                       TO_CHAR(ends_at, ${TIME_FORMAT}) AS ends_at`,
            [order.user_id, noShow.no_show_id, reason, policy.restriction_days]
        );

        restriction = restrictionResult.rows[0];
    }

    await client.query(
        `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details)
         VALUES ($1, 'order_marked_no_show', 'order', $2, $3)`,
        [
            staffUserId,
            orderId,
            JSON.stringify({
                customer_id: order.user_id,
                no_show_id: noShow.no_show_id,
                offense_count: offenseCount,
                policy_result: policyResult,
                restriction_id: restriction ? restriction.restriction_id : null,
                restriction_ends_at: restriction ? restriction.ends_at : null
            })
        ]
    );

    return {
        order: updated.rows[0],
        no_show: noShow,
        restriction
    };
}

// No-show history and restriction status for ONE customer.
// Callers must make sure the user is allowed to see this customer.
async function getPenaltySummary(db, userId) {
    const policy = await getPolicy(db);

    const historyResult = await db.query(
        `SELECT n.no_show_id, n.order_id, o.queue_number,
                TO_CHAR(o.order_date, 'YYYY-MM-DD') AS order_date,
                TO_CHAR(n.recorded_at, ${TIME_FORMAT}) AS recorded_at,
                n.offense_count, n.policy_result,
                n.recorded_at >= CURRENT_TIMESTAMP - make_interval(days => $2) AS counts_toward_policy
         FROM no_show_records n
         JOIN orders o ON o.order_id = n.order_id
         WHERE n.user_id = $1
         ORDER BY n.recorded_at DESC`,
        [userId, policy.offense_window_days]
    );

    let recentCount = 0;

    for (const row of historyResult.rows) {
        if (row.counts_toward_policy) {
            recentCount++;
        }
    }

    const activeRestriction = await findActiveRestriction(db, userId);

    return {
        recent_no_show_count: recentCount,
        offense_threshold: policy.offense_threshold,
        offense_window_days: policy.offense_window_days,
        restriction_days: policy.restriction_days,
        active_restriction: activeRestriction,
        history: historyResult.rows
    };
}

module.exports = {
    getPolicy,
    findActiveRestriction,
    decidePolicyResult,
    markOrderNoShow,
    getPenaltySummary
};
