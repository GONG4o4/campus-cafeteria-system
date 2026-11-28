// Same-day scheduled pickup (issue #96).
//
// All time math is done by PostgreSQL in the Asia/Manila time zone, so the
// result is the same no matter what time zone the server computer uses.
// The browser only sends a time like "10:30"; the backend turns it into
// an exact moment for TODAY in Manila and checks every rule here.

// Unpaid orders older than this stop counting (for the unpaid-order limit
// and for slot bookings), so an abandoned checkout does not hold a slot.
const UNPAID_WINDOW_MINUTES = 60;

// "Booked" = not cancelled, and either paid or still waiting for payment.
// $1 in the outer query must be the slot time (timestamptz).
const ACTIVE_BOOKING = `
    o.status <> 'cancelled'
    AND (
        EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.order_id AND p.status = 'paid')
        OR o.ordered_at >= CURRENT_TIMESTAMP - make_interval(mins => ${UNPAID_WINDOW_MINUTES})
    )`;

async function getPickupSettings(db) {
    const result = await db.query(
        `SELECT TO_CHAR(open_time, 'HH24:MI') AS open_time,
                TO_CHAR(close_time, 'HH24:MI') AS close_time,
                slot_minutes, slot_capacity, prep_lead_minutes, booking_buffer_minutes
         FROM pickup_settings
         WHERE setting_id = 1`
    );

    if (result.rows.length === 0) {
        throw new Error("Pickup settings are missing. Run migration 009.");
    }

    return result.rows[0];
}

// "14:30" -> "2:30 PM"
function formatTime(value) {
    const [hourText, minute] = value.split(":");
    const hour = Number(hourText);
    const suffix = hour >= 12 ? "PM" : "AM";
    const shownHour = hour % 12 === 0 ? 12 : hour % 12;

    return `${shownHour}:${minute} ${suffix}`;
}

// Every pickup time for today, from opening time to the last slot
// before closing, with how many places are left.
async function getTodaySlots(db) {
    const settings = await getPickupSettings(db);

    const result = await db.query(
        `WITH s AS (
            SELECT * FROM pickup_settings WHERE setting_id = 1
         ),
         today AS (
            SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date AS d
         ),
         slots AS (
            SELECT generate_series(
                today.d + s.open_time,
                today.d + s.close_time - make_interval(mins => s.slot_minutes),
                make_interval(mins => s.slot_minutes)
            ) AS local_time
            FROM s, today
         )
         SELECT
            TO_CHAR(slots.local_time, 'HH24:MI') AS time,
            (slots.local_time AT TIME ZONE 'Asia/Manila') >= CURRENT_TIMESTAMP
                + make_interval(mins => s.prep_lead_minutes + s.booking_buffer_minutes) AS bookable,
            (
                SELECT COUNT(*)::int
                FROM orders o
                WHERE o.scheduled_pickup_at = (slots.local_time AT TIME ZONE 'Asia/Manila')
                  AND ${ACTIVE_BOOKING}
            ) AS booked
         FROM slots, s
         ORDER BY slots.local_time`
    );

    const dateResult = await db.query(
        `SELECT TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date, 'YYYY-MM-DD') AS today`
    );

    const slots = result.rows
        .filter((row) => row.bookable)
        .map((row) => ({
            time: row.time,
            label: formatTime(row.time),
            remaining: Math.max(settings.slot_capacity - row.booked, 0),
            full: row.booked >= settings.slot_capacity
        }));

    return {
        date: dateResult.rows[0].today,
        open_time: settings.open_time,
        close_time: settings.close_time,
        slot_minutes: settings.slot_minutes,
        slot_capacity: settings.slot_capacity,
        slots
    };
}

// Checks a requested pickup time ("HH:MM") for TODAY and reserves the slot.
// Must be called inside the order transaction. The advisory lock makes two
// customers booking the same slot at the same moment wait for each other,
// so the capacity can never be exceeded.
//
// Returns { error: "message" } or { scheduledAt } (an ISO timestamp string).
async function checkScheduledPickup(client, time) {
    if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        return { error: "Choose a pickup time from the list." };
    }

    const settings = await getPickupSettings(client);

    const result = await client.query(
        `WITH s AS (
            SELECT * FROM pickup_settings WHERE setting_id = 1
         ),
         req AS (
            SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date + $1::time) AS local_time
         )
         SELECT
            req.local_time::time >= s.open_time
                AND req.local_time::time <= s.close_time - make_interval(mins => s.slot_minutes) AS in_hours,
            (EXTRACT(EPOCH FROM (req.local_time::time - s.open_time))::int / 60) % s.slot_minutes = 0 AS on_slot,
            (req.local_time AT TIME ZONE 'Asia/Manila') >= CURRENT_TIMESTAMP
                + make_interval(mins => s.prep_lead_minutes + s.booking_buffer_minutes) AS far_enough,
            (req.local_time AT TIME ZONE 'Asia/Manila') AS scheduled_at,
            (EXTRACT(EPOCH FROM (req.local_time AT TIME ZONE 'Asia/Manila')) / 60)::int AS lock_key
         FROM s, req`,
        [time]
    );

    const row = result.rows[0];
    const lastSlot = await client.query(
        `SELECT TO_CHAR(close_time - make_interval(mins => slot_minutes), 'HH24:MI') AS last_time
         FROM pickup_settings WHERE setting_id = 1`
    );

    if (!row.in_hours) {
        return {
            error: `Pickup times must be between ${formatTime(settings.open_time)} and ${formatTime(lastSlot.rows[0].last_time)} today.`
        };
    }

    if (!row.on_slot) {
        return { error: "Choose a pickup time from the list." };
    }

    if (!row.far_enough) {
        return {
            error: `That pickup time is too soon or has already passed. The kitchen needs at least ${settings.prep_lead_minutes + settings.booking_buffer_minutes} minutes. Please choose a later time or ASAP.`
        };
    }

    // One lock per slot. Other slots are not blocked.
    await client.query("SELECT pg_advisory_xact_lock(34035, $1)", [row.lock_key]);

    const booked = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM orders o
         WHERE o.scheduled_pickup_at = $1
           AND ${ACTIVE_BOOKING}`,
        [row.scheduled_at]
    );

    if (booked.rows[0].count >= settings.slot_capacity) {
        return {
            error: `The ${formatTime(time)} pickup time is full. Please choose another time.`,
            full: true
        };
    }

    return { scheduledAt: row.scheduled_at };
}

module.exports = {
    UNPAID_WINDOW_MINUTES,
    getPickupSettings,
    getTodaySlots,
    checkScheduledPickup,
    formatTime
};
