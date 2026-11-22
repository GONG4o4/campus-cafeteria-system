const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const pool = require("../db");
const menu = require("../routes/menu");
const { getBestSellers } = require("../services/bestSellers");

const originalQuery = pool.query;

// ---------------------------------------------------------------
// Part 1: the API route, with the database mocked
// ---------------------------------------------------------------
describe("GET /api/menu/best-sellers", () => {
    let server;
    let baseUrl;

    before(async () => {
        const app = express();
        app.use(express.json());
        app.use("/api/menu", menu);

        server = app.listen(0, "127.0.0.1");

        await new Promise((resolve, reject) => {
            server.once("listening", resolve);
            server.once("error", reject);
        });

        baseUrl = `http://127.0.0.1:${server.address().port}/api/menu`;
    });

    beforeEach(() => {
        pool.query = async () => {
            throw new Error("Unexpected database query");
        };
    });

    after(async () => {
        pool.query = originalQuery;
        await new Promise((resolve) => server.close(resolve));
    });

    test("returns ranked items and the period, without login", async () => {
        pool.query = async (sql) => {
            assert.match(sql, /o\.status = 'picked_up'/);
            return {
                rows: [
                    { menu_item_id: 4, name: "Chicken Adobo", image_url: null, quantity_sold: 12, revenue: "900.00" },
                    { menu_item_id: 2, name: "Test Rice Meal", image_url: "https://example.com/a.jpg", quantity_sold: 5, revenue: "375.00" }
                ]
            };
        };

        const response = await fetch(`${baseUrl}/best-sellers`);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(data, {
            items: [
                { menu_item_id: 4, name: "Chicken Adobo", image_url: null, quantity_sold: 12, rank: 1 },
                { menu_item_id: 2, name: "Test Rice Meal", image_url: "https://example.com/a.jpg", quantity_sold: 5, rank: 2 }
            ],
            period: { type: "rolling_days", days: 30 }
        });
    });

    test("does not send revenue to the browser", async () => {
        pool.query = async () => ({
            rows: [{ menu_item_id: 1, name: "Meal", image_url: null, quantity_sold: 3, revenue: "150.00" }]
        });

        const response = await fetch(`${baseUrl}/best-sellers`);
        const data = await response.json();

        assert.equal(data.items[0].revenue, undefined);
    });

    test("returns an empty list when nothing was sold", async () => {
        pool.query = async () => ({ rows: [] });

        const response = await fetch(`${baseUrl}/best-sellers`);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(data.items, []);
    });

    test("returns 500 without database details when the query fails", async () => {
        pool.query = async () => {
            throw new Error("private database details");
        };

        const response = await fetch(`${baseUrl}/best-sellers`);
        const data = await response.json();

        assert.equal(response.status, 500);
        assert.equal(data.message, "Failed to load best sellers");
    });

    test("is not treated as a menu item ID", async () => {
        let ranOnce = false;

        pool.query = async (sql) => {
            ranOnce = true;
            assert.doesNotMatch(sql, /WHERE menu_item_id = \$1/);
            return { rows: [] };
        };

        const response = await fetch(`${baseUrl}/best-sellers`);

        assert.equal(response.status, 200);
        assert.equal(ranOnce, true);
    });
});

// ---------------------------------------------------------------
// Part 2: the ranking query, against a real database.
// Every test runs inside a transaction that is always rolled back,
// so nothing is saved. Skipped when no database is available.
// ---------------------------------------------------------------
describe("best seller ranking query (real database)", () => {
    let databaseReady = false;

    before(async () => {
        try {
            const client = await pool.connect();
            await client.query("SELECT 1 FROM order_items LIMIT 1");
            client.release();
            databaseReady = true;
        } catch {
            databaseReady = false;
        }
    });

    after(async () => {
        await pool.end();
    });

    // Runs one test inside a transaction and rolls it back afterwards.
    async function withTestData(t, run) {
        if (!databaseReady) {
            t.skip("No database available");
            return;
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Hide real sales so only this test's data is ranked.
            // This is undone by the ROLLBACK below.
            await client.query("UPDATE orders SET status = 'cancelled' WHERE status = 'picked_up'");

            const user = await client.query(
                `INSERT INTO users (password, role, email, fname, lname)
                 VALUES ('x', 'student', $1, 'Test', 'Student')
                 RETURNING user_id`,
                [`best-seller-test-${Date.now()}@example.com`]
            );

            const helpers = {
                client,
                userId: user.rows[0].user_id,
                nextQueue: 9000
            };

            await run(helpers);
        } finally {
            await client.query("ROLLBACK");
            client.release();
        }
    }

    async function addItem(h, name, price) {
        const result = await h.client.query(
            `INSERT INTO menu_items (name, price, is_available)
             VALUES ($1, $2, true)
             RETURNING menu_item_id`,
            [name, price]
        );

        return result.rows[0].menu_item_id;
    }

    // lines: [[menuItemId, quantity, unitPrice], ...]
    // daysAgo: 0 = today in Manila
    async function addOrder(h, status, daysAgo, lines) {
        h.nextQueue++;

        let total = 0;
        for (const line of lines) {
            total += line[1] * line[2];
        }

        const order = await h.client.query(
            `INSERT INTO orders (user_id, queue_number, status, total_amount, order_date)
             VALUES ($1, $2, $3, $4, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date - $5::int)
             RETURNING order_id`,
            [h.userId, h.nextQueue, status, total, daysAgo]
        );

        for (const line of lines) {
            await h.client.query(
                `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, subtotal)
                 VALUES ($1, $2, $3, $4, $5)`,
                [order.rows[0].order_id, line[0], line[1], line[2], line[1] * line[2]]
            );
        }
    }

    function ids(items) {
        return items.map((item) => item.menu_item_id);
    }

    test("item with more picked-up units ranks higher", async (t) => {
        await withTestData(t, async (h) => {
            const a = await addItem(h, "Item A", 50);
            const b = await addItem(h, "Item B", 50);

            await addOrder(h, "picked_up", 0, [[a, 2, 50]]);
            await addOrder(h, "picked_up", 0, [[b, 5, 50]]);

            const items = await getBestSellers(h.client);

            assert.deepEqual(ids(items), [b, a]);
            assert.equal(items[0].rank, 1);
            assert.equal(items[1].rank, 2);
        });
    });

    test("adds up the same item across many orders", async (t) => {
        await withTestData(t, async (h) => {
            const a = await addItem(h, "Item A", 50);
            const b = await addItem(h, "Item B", 50);

            await addOrder(h, "picked_up", 0, [[a, 2, 50]]);
            await addOrder(h, "picked_up", 1, [[a, 2, 50], [b, 3, 50]]);

            const items = await getBestSellers(h.client);

            assert.deepEqual(ids(items), [a, b]);
            assert.equal(items[0].quantity_sold, 4);
            assert.equal(items[1].quantity_sold, 3);
        });
    });

    test("does not count pending, preparing, ready, cancelled or no-show orders", async (t) => {
        await withTestData(t, async (h) => {
            const sold = await addItem(h, "Sold", 50);
            const notSold = await addItem(h, "Not sold", 50);

            await addOrder(h, "picked_up", 0, [[sold, 1, 50]]);

            for (const status of ["pending", "preparing", "ready", "cancelled", "no_show"]) {
                await addOrder(h, status, 0, [[notSold, 100, 50], [sold, 100, 50]]);
            }

            const items = await getBestSellers(h.client);

            assert.deepEqual(ids(items), [sold]);
            assert.equal(items[0].quantity_sold, 1);
        });
    });

    test("breaks ties by revenue, then by menu item ID", async (t) => {
        await withTestData(t, async (h) => {
            const cheap = await addItem(h, "Cheap", 40);
            const pricey = await addItem(h, "Pricey", 90);
            const sameA = await addItem(h, "Same A", 60);
            const sameB = await addItem(h, "Same B", 60);

            // All four sold 3 units.
            await addOrder(h, "picked_up", 0, [[cheap, 3, 40]]);
            await addOrder(h, "picked_up", 0, [[pricey, 3, 90]]);
            await addOrder(h, "picked_up", 0, [[sameB, 3, 60]]);
            await addOrder(h, "picked_up", 0, [[sameA, 3, 60]]);

            const items = await getBestSellers(h.client);

            // Highest revenue first; sameA and sameB tie on revenue,
            // so the lower ID (sameA, created first) wins.
            assert.deepEqual(ids(items), [pricey, sameA, sameB, cheap]);
        });
    });

    test("never returns more than 10 items", async (t) => {
        await withTestData(t, async (h) => {
            for (let i = 1; i <= 12; i++) {
                const id = await addItem(h, `Item ${i}`, 50);
                await addOrder(h, "picked_up", 0, [[id, i, 50]]);
            }

            const items = await getBestSellers(h.client);

            assert.equal(items.length, 10);
            assert.equal(items[0].quantity_sold, 12);
            assert.equal(items[9].quantity_sold, 3);
        });
    });

    test("returns an empty list when nothing was picked up", async (t) => {
        await withTestData(t, async (h) => {
            const items = await getBestSellers(h.client);

            assert.deepEqual(items, []);
        });
    });

    test("only counts the last 30 days in Manila time", async (t) => {
        await withTestData(t, async (h) => {
            const recent = await addItem(h, "Recent", 50);
            const old = await addItem(h, "Old", 50);

            await addOrder(h, "picked_up", 29, [[recent, 1, 50]]);
            await addOrder(h, "picked_up", 30, [[old, 50, 50]]);

            const items = await getBestSellers(h.client);

            assert.deepEqual(ids(items), [recent]);
        });
    });
});
