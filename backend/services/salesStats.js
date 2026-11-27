// Sales statistics for the staff summary page and the admin reports page.
//
// period can be "day", "week", "month" or "year".
// All dates use Asia/Manila time, the same as orders.order_date.
// Cancelled orders are never counted as sales.

// unit  = the PostgreSQL date_trunc unit
// count = how many bars to show in the trend chart
const PERIODS = {
    day: { unit: "day", count: 14 },
    week: { unit: "week", count: 12 },
    month: { unit: "month", count: 12 },
    year: { unit: "year", count: 5 }
};

const TOP_ITEMS_LIMIT = 5;

function isValidPeriod(period) {
    return Object.prototype.hasOwnProperty.call(PERIODS, period);
}

async function getSalesStats(db, period) {
    const { unit, count } = PERIODS[period];

    // One row per day / week / month / year, oldest first.
    // generate_series makes sure empty periods still show up as 0.
    const trend = await db.query(
        `WITH today AS (
            SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date AS d
         ),
         buckets AS (
            SELECT generate_series(
                date_trunc($1, (SELECT d FROM today)::timestamp) - ($2::int - 1) * ('1 ' || $1)::interval,
                date_trunc($1, (SELECT d FROM today)::timestamp),
                ('1 ' || $1)::interval
            )::date AS start_date
         )
         SELECT
            TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date,
            COUNT(o.order_id)::int AS orders,
            COUNT(o.order_id) FILTER (WHERE o.status = 'picked_up')::int AS completed,
            COALESCE(SUM(o.total_amount), 0) AS sales
         FROM buckets b
         LEFT JOIN orders o
            ON o.status <> 'cancelled'
           AND o.order_date >= b.start_date
           AND o.order_date < (b.start_date + ('1 ' || $1)::interval)::date
         GROUP BY b.start_date
         ORDER BY b.start_date ASC`,
        [unit, count]
    );

    // Top meals in the current day / week / month / year.
    const topItems = await db.query(
        `SELECT
            mi.menu_item_id,
            mi.name,
            SUM(oi.quantity)::int AS quantity,
            SUM(oi.subtotal) AS sales
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         JOIN menu_items mi ON mi.menu_item_id = oi.menu_item_id
         WHERE o.status <> 'cancelled'
           AND o.order_date >= date_trunc($1, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date::timestamp)::date
         GROUP BY mi.menu_item_id, mi.name
         ORDER BY quantity DESC, sales DESC, mi.name ASC
         LIMIT $2`,
        [unit, TOP_ITEMS_LIMIT]
    );

    const rows = trend.rows.map((row) => ({
        start_date: row.start_date,
        orders: row.orders,
        completed: row.completed,
        sales: Number(row.sales)
    }));

    // The last row is the current period, the one before it is the previous one.
    const empty = { start_date: null, orders: 0, completed: 0, sales: 0 };
    const current = rows[rows.length - 1] || empty;
    const previous = rows[rows.length - 2] || empty;

    let average = 0;

    if (current.orders > 0) {
        average = Math.round((current.sales / current.orders) * 100) / 100;
    }

    return {
        period,
        current: { ...current, average },
        previous,
        trend: rows,
        top_items: topItems.rows.map((item) => ({
            menu_item_id: item.menu_item_id,
            name: item.name,
            quantity: item.quantity,
            sales: Number(item.sales)
        }))
    };
}

module.exports = {
    PERIODS,
    isValidPeriod,
    getSalesStats
};
