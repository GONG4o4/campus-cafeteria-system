// Top best-selling menu items.
// Only orders that were actually picked up count as sales. Pending,
// preparing, ready, cancelled and no-show orders are never counted.

// Change these to change the ranking. Nothing else needs to be edited.
const BEST_SELLER_DAYS = 30;
const BEST_SELLER_LIMIT = 10;

// Returns up to BEST_SELLER_LIMIT items, best seller first.
//
// The window is the last BEST_SELLER_DAYS days in Asia/Manila time,
// counting today. It uses orders.order_date, which is already saved
// as the Manila date when the order is placed.
//
// Ties: more units sold first, then more revenue, then the lower
// menu_item_id, so the order is always the same.
//
// Unavailable items are still ranked, so turning an item off does not
// erase its sales history. Items that were ever ordered cannot be
// deleted (the menu API blocks it), so deleted items never show up here.
async function getBestSellers(db) {
    const result = await db.query(
        `SELECT mi.menu_item_id,
                mi.name,
                mi.image_url,
                SUM(oi.quantity)::int AS quantity_sold,
                SUM(oi.subtotal) AS revenue
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         JOIN menu_items mi ON mi.menu_item_id = oi.menu_item_id
         WHERE o.status = 'picked_up'
           AND o.order_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date - $1::int
         GROUP BY mi.menu_item_id, mi.name, mi.image_url
         ORDER BY quantity_sold DESC, revenue DESC, mi.menu_item_id ASC
         LIMIT $2`,
        [BEST_SELLER_DAYS, BEST_SELLER_LIMIT]
    );

    const items = [];

    for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows[i];

        items.push({
            menu_item_id: row.menu_item_id,
            name: row.name,
            image_url: row.image_url,
            quantity_sold: row.quantity_sold,
            rank: i + 1
        });
    }

    return items;
}

module.exports = {
    BEST_SELLER_DAYS,
    BEST_SELLER_LIMIT,
    getBestSellers
};
