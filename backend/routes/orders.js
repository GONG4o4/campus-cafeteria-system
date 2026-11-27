const express = require("express");
const pool = require("../db");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const { createPaymentRequest, getPaymentRequest } = require("../services/hitpay");
const { confirmPayment } = require("../services/paymentConfirm");
const { findActiveRestriction, getPenaltySummary, getPolicy } = require("../services/noShow");

const router = express.Router();

// Anti-spam limit: how many unpaid orders a customer can have at once.
// Only orders placed in the last UNPAID_WINDOW_MINUTES count, so an old
// abandoned checkout does not block the customer forever.
const MAX_UNPAID_ORDERS = 2;
const UNPAID_WINDOW_MINUTES = 60;

const orderSelect = `
    SELECT o.order_id, o.queue_number, o.status, o.total_amount, o.order_date,
           TO_CHAR(o.ordered_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS ordered_at,
           COALESCE((
               SELECT p.status 
               FROM payments p 
               WHERE p.order_id = o.order_id 
               ORDER BY p.payment_id DESC 
               LIMIT 1
           ), 'unpaid') AS payment_status,
           COALESCE((
               SELECT json_agg(json_build_object(
                   'order_item_id', i.order_item_id,
                   'menu_item_id', i.menu_item_id,
                   'name', m.name,
                   'quantity', i.quantity,
                   'unit_price', i.unit_price,
                   'subtotal', i.subtotal
               ) ORDER BY i.order_item_id)
               FROM order_items i
               JOIN menu_items m ON m.menu_item_id = i.menu_item_id
               WHERE i.order_id = o.order_id
           ), '[]'::json) AS items
    FROM orders o
    WHERE o.user_id = $1`;

router.get("/", authenticateToken, requireRole("student"), async (req, res) => {
    try {
        const result = await pool.query(
            `${orderSelect} ORDER BY o.ordered_at DESC, o.order_id DESC`,
            [req.user.user_id]
        );

        return res.json(result.rows);
    } catch (error) {
        console.error("Order history failed:", error.message);
        return res.status(500).json({
            message: "Unable to load your orders. Please try again."
        });
    }
});

// The no-show policy shown at checkout. The numbers come from the
// database so the checkout warning always matches what the backend enforces.
router.get("/no-show-policy", authenticateToken, requireRole("student"), async (req, res) => {
    try {
        const policy = await getPolicy(pool);
        return res.json(policy);
    } catch (error) {
        console.error("No-show policy failed:", error.message);
        return res.status(500).json({
            message: "Unable to load the pickup policy. Please try again."
        });
    }
});

// The logged-in student's own no-show history and restriction status.
// Must stay above "/:id" so "penalty-status" is not read as an order ID.
router.get("/penalty-status", authenticateToken, requireRole("student"), async (req, res) => {
    try {
        const summary = await getPenaltySummary(pool, req.user.user_id);
        return res.json(summary);
    } catch (error) {
        console.error("Penalty status failed:", error.message);
        return res.status(500).json({
            message: "Unable to load your account status. Please try again."
        });
    }
});

router.get("/:id", authenticateToken, requireRole("student"), async (req, res) => {
    const id = Number(req.params.id);

    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(id) || id > 2147483647) {
        return res.status(400).json({ message: "Invalid order ID" });
    }

    try {
        const result = await pool.query(
            `${orderSelect} AND o.order_id = $2`,
            [req.user.user_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        return res.json(result.rows[0]);
    } catch (error) {
        console.error("Order details failed:", error.message);
        return res.status(500).json({
            message: "Unable to load this order. Please try again."
        });
    }
});

// Called by the payment success page. Asks HitPay directly if the order
// was paid, and if so assigns the queue number. This works even when HitPay
// cannot reach our webhook (for example when the backend runs on localhost).
router.post("/:id/verify-payment", authenticateToken, requireRole("student"), async (req, res) => {
    const id = Number(req.params.id);

    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(id) || id > 2147483647) {
        return res.status(400).json({ message: "Invalid order ID" });
    }

    let client;
    try {
        // Only look at the student's own order.
        const paymentResult = await pool.query(
            `SELECT p.checkout_session_id, p.status
             FROM payments p
             JOIN orders o ON o.order_id = p.order_id
             WHERE o.order_id = $1 AND o.user_id = $2
             ORDER BY p.payment_id DESC
             LIMIT 1`,
            [id, req.user.user_id]
        );

        if (paymentResult.rows.length === 0) {
            return res.status(404).json({ message: "Payment not found for this order" });
        }

        const payment = paymentResult.rows[0];

        // Already paid or cancelled, nothing to check with HitPay.
        if (payment.status !== "pending") {
            return res.json({ payment_status: payment.status });
        }

        const hitpayPayment = await getPaymentRequest(payment.checkout_session_id);

        if (hitpayPayment.status !== "completed") {
            return res.json({ payment_status: "pending" });
        }

        client = await pool.connect();
        await client.query("BEGIN");

        const result = await confirmPayment(
            client,
            payment.checkout_session_id,
            hitpayPayment.amount,
            `verify_${payment.checkout_session_id}_${Date.now()}`
        );

        if (result === "paid") {
            await client.query("COMMIT");
            return res.json({ payment_status: "paid" });
        }

        await client.query("ROLLBACK");

        if (result === "already_paid") {
            return res.json({ payment_status: "paid" });
        }

        return res.status(400).json({ message: "Payment could not be confirmed" });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK");
        }
        console.error("Payment verify failed:", error.message);
        return res.status(500).json({ message: "Unable to check payment status. Please try again." });
    } finally {
        if (client) {
            client.release();
        }
    }
});

const toCents = (price) => {
     const [whole, fraction = ""] = String(price).split(".");
     return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
};

const toAmount = (cents) => {
    return `${cents /100n}.${String(cents % 100n).padStart(2, "0")}`;
};

router.post("/", authenticateToken, requireRole("student"), async (req, res) => {
    const items = req.body?.items;

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
        return res.status(400).json({
            message: "Invalid or empty cart"
            });
        }

        // The customer must tick the no-show policy checkbox at checkout.
        // Checked here too, so calling the API directly cannot skip it.
        if (req.body?.acknowledge_no_show_policy !== true) {
            return res.status(400).json({
                message: "Please confirm that you have read the pickup and no-show policy before placing your order.",
                code: "NO_SHOW_POLICY_NOT_ACKNOWLEDGED"
            });
        }

        const seenIds = new Set();

        for (const item of items) {
            if (!item || !Number.isInteger(item.menu_item_id) || item.menu_item_id <= 0 || item.menu_item_id > 2147483647 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 || seenIds.has(item.menu_item_id)
                ) {
                    return res.status(400).json({
                         message: "Invalid menu item ID or quantity"
                         });
                    }
                seenIds.add(item.menu_item_id);
            }

            let client;

            try {
                client = await pool.connect();
                await client.query("BEGIN");

                // Customers with an active no-show restriction cannot order.
                const restriction = await findActiveRestriction(client, req.user.user_id);

                if (restriction) {
                    await client.query("ROLLBACK");
                    return res.status(403).json({
                        message: `Your account cannot place orders until ${restriction.ends_at} because of uncollected orders.`,
                        code: "ORDERING_RESTRICTED",
                        restriction: restriction
                    });
                }

                // Anti-spam: a customer can only have a few unpaid orders at
                // a time. Locking the user's row first makes two quick clicks
                // wait for each other, so both cannot slip past the count.
                await client.query(
                    "SELECT user_id FROM users WHERE user_id = $1 FOR UPDATE",
                    [req.user.user_id]
                );

                const unpaidResult = await client.query(
                    `SELECT COUNT(*)::int AS count
                     FROM orders o
                     WHERE o.user_id = $1
                       AND o.status = 'pending'
                       AND o.ordered_at >= CURRENT_TIMESTAMP - make_interval(mins => $2)
                       AND NOT EXISTS (
                           SELECT 1 FROM payments p
                           WHERE p.order_id = o.order_id AND p.status = 'paid'
                       )`,
                    [req.user.user_id, UNPAID_WINDOW_MINUTES]
                );

                if (unpaidResult.rows[0].count >= MAX_UNPAID_ORDERS) {
                    await client.query("ROLLBACK");
                    return res.status(429).json({
                        message: `You already have ${MAX_UNPAID_ORDERS} unpaid orders. Please pay for or cancel one in your Order history before placing a new order.`,
                        code: "TOO_MANY_UNPAID_ORDERS"
                    });
                }

                const ids = items.map(item => item.menu_item_id);
                const menuResult = await client.query(
                    `SELECT menu_item_id, price, is_available, name
                    FROM menu_items
                    WHERE menu_item_id = ANY($1::int[])
                    ORDER BY menu_item_id
                    FOR SHARE`,
                    [ids]
                );
                const menuMap = new Map(
                    menuResult.rows.map(item => [item.menu_item_id, item])
                );
                let totalCents = 0n;
                const orderItems = [];
                for (const item of items) {
                    const menuItem = menuMap.get(item.menu_item_id);
                    if (!menuItem || !menuItem.is_available) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({
                            message: "Menu item does not exist or is unavailable"
                        });
                    }

                    const unitCents = toCents(menuItem.price);
                    const subtotalCents = unitCents * BigInt(item.quantity);

                    totalCents += subtotalCents;

                    orderItems.push({
                        menu_item_id: item.menu_item_id,
                        name: menuItem.name,
                        quantity: item.quantity,
                        unit_price: toAmount(unitCents),
                        subtotal: toAmount(subtotalCents)
                    });
                }

                if (totalCents > 9999999999n) {
                    await client.query("ROLLBACK");
                    return res.status(400).json({
                        message: "Order total exceeds the allowed amount"
                    });
                }

                const dateResult = await client.query(
                    `SELECT TO_CHAR(
                        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date, 'YYYY-MM-DD') AS order_date`
                );

                const orderDate = dateResult.rows[0].order_date;

                // Save which policy version the customer accepted.
                // The time is the server's time, not the browser's.
                const policy = await getPolicy(client);

                const orderResult = await client.query(
                    `INSERT INTO orders (user_id, total_amount, order_date, no_show_ack_at, no_show_policy_version)
                    VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
                    RETURNING order_id, status, total_amount, order_date`,
                    [
                        req.user.user_id, toAmount(totalCents), orderDate, policy.policy_version
                    ]
                );

                const order = orderResult.rows[0];

                for (const item of orderItems) {
                    await client.query(
                        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, subtotal) VALUES ($1, $2, $3, $4, $5)`,
                        [
                            order.order_id, item.menu_item_id, item.quantity, item.unit_price, item.subtotal
                        ]
                    );
                }

                const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
                const redirectUrl = `${clientUrl}/payment/success?order_id=${order.order_id}`;

                const hitpayData = await createPaymentRequest(
                    order.order_id,
                    order.total_amount,
                    redirectUrl
                );

                await client.query(
                    `INSERT INTO payments (order_id, checkout_session_id, reference_number, amount, status) VALUES ($1, $2, $3, $4, 'pending')`,
                    [order.order_id, hitpayData.paymentRequestId, hitpayData.referenceNumber, order.total_amount]
                );

                await client.query("COMMIT");

                return res.status(201).json({
                    message: "Order created. Please complete payment.",
                    order_id: order.order_id,
                    checkout_url: hitpayData.checkoutUrl,
                    total_amount: order.total_amount
                });

} catch (error){
    if (client) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError){
            console.error("Order rollback failed:", rollbackError.message);
        }
    }

    console.error("Order creation failed: ", error.message);

    return res.status(500).json({
        message: "Failed to create order",
        details: error.message
    });

    } finally {
        if (client) {
            client.release();
        }
    }
});

router.patch("/:id/cancel", authenticateToken, requireRole("student"), async (req, res) => {
  const id = Number(req.params.id);

  if (
    !/^[1-9]\d*$/.test(req.params.id) ||
    !Number.isSafeInteger(id) ||
    id > 2147483647
  ) {
    return res.status(400).json({ message: "Invalid order ID" });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const updated = await client.query(
      `UPDATE orders
       SET status = 'cancelled',
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $1
         AND user_id = $2
         AND status = 'pending'
       RETURNING order_id, status`,
      [id, req.user.user_id]
    );

    if (updated.rows.length > 0) {
      await client.query(
        `UPDATE payments
         SET status = 'cancelled',
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1
           AND status IN ('unpaid', 'pending')`,
        [id]
      );
      await client.query("COMMIT");
      return res.json({
        message: "Order cancelled successfully",
        order: updated.rows[0]
      });
    }

    const existing = await client.query(
      "SELECT status FROM orders WHERE order_id = $1 AND user_id = $2",
      [id, req.user.user_id]
    );

    await client.query("ROLLBACK");

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.status(409).json({
      message: "Only pending orders can be cancelled"
    });
} catch (error){
    if (client) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError){
            console.error("Order rollback failed:", rollbackError.message);
        }
    }

    console.error("Order creation failed: ", error.message);

    return res.status(500).json({
        message: "Failed to create order",
        details: error.message || "Unknown error"
    });

    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router;