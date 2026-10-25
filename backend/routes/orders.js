const express = require("express");
const pool = require("../db");
const {authenticateToken, requireRole} = require ("../middleware/authMiddleware");

const router = express.Router();

const orderSelect = `
    SELECT o.order_id, o.queue_number, o.status, o.total_amount, o.order_date,
           TO_CHAR(o.ordered_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS ordered_at,
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
                const ids = items.map(item => item.menu_item_id);
                const menuResult = await client.query(
                    `SELECT menu_item_id, price, is_available
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

                await client.query(
                    "SELECT pg_advisory_xact_lock(34034, 1)"
                );

                const dateResult = await client.query(
                    `SELECT TO_CHAR(
                        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date, 'YYYY-MM-DD') AS order_date`
                );

        const orderDate = dateResult.rows[0].order_date;

        const queueResult = await client.query(
            `SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_number FROM  orders WHERE order_date = $1::date`,
            [orderDate]
        );

        const queueNumber = Number(queueResult.rows[0].next_number);

        const orderResult = await client.query(
            `INSERT INTO orders (user_id, queue_number, total_amount, order_date) VALUES ($1, $2, $3, $4)
            RETURNING order_id, queue_number, status, total_amount, order_date`,
            [
                req.user.user_id, queueNumber, toAmount(totalCents), orderDate
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

    await client.query("COMMIT");

    return res.status(201).json({
        message: "Order placed successfully",
        order_id: order.order_id,
        queue_number: order.queue_number,
        status: order.status,
        total_amount: order.total_amount,
        order_date: order.order_date
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
        message: "Failed to create order"
    });

    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router;
