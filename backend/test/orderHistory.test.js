const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const orders = require("../routes/orders");

const originalQuery = pool.query;
const previousSecret = process.env.JWT_SECRET;
const secret = "order-history-tests-only-secret";
let server;
let baseUrl;

const savedOrders = [
    {
        order_id: 12,
        user_id: 3,
        queue_number: 4,
        status: "ready",
        total_amount: "150.00",
        ordered_at: "2026-10-26T11:30:00.000",
        items: [{
            order_item_id: 1,
            menu_item_id: 2,
            name: "Chicken Rice",
            quantity: 2,
            unit_price: 75,
            subtotal: 150
        }]
    },
    {
        order_id: 11,
        user_id: 3,
        queue_number: 3,
        status: "picked_up",
        total_amount: "75.00",
        ordered_at: "2026-10-26T11:30:00.000",
        items: []
    },
    {
        order_id: 10,
        user_id: 4,
        queue_number: 2,
        status: "pending",
        total_amount: "90.00",
        ordered_at: "2026-10-25T11:30:00.000",
        items: []
    }
];

before(async () => {
    process.env.JWT_SECRET = secret;
    const app = express();
    app.use("/api/orders", orders);
    server = app.listen(0, "127.0.0.1");

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    baseUrl = `http://127.0.0.1:${server.address().port}/api/orders`;
});

beforeEach(() => {
    pool.query = async (sql, params) => {
        assert.match(sql, /WHERE o.user_id = \$1/);
        assert.match(sql, /i.unit_price/);
        assert.match(sql, /i.subtotal/);
        let rows = savedOrders.filter((order) => order.user_id === params[0]);

        if (params.length === 2) {
            assert.match(sql, /AND o.order_id = \$2/);
            rows = rows.filter((order) => order.order_id === params[1]);
        } else {
            assert.match(sql, /ORDER BY o.ordered_at DESC, o.order_id DESC/);
        }

        return { rows: rows.map(({ user_id, ...order }) => order) };
    };
});

after(async () => {
    pool.query = originalQuery;
    await new Promise((resolve) => server.close(resolve));

    if (previousSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = previousSecret;
    }
});

function request(path = "", userId = 3, role = "student") {
    const headers = {};

    if (userId !== null) {
        const token = jwt.sign({ user_id: userId, role }, secret, { expiresIn: "1h" });
        headers.Authorization = `Bearer ${token}`;
    }

    return fetch(baseUrl + path, { headers });
}

test("history returns JSON and only the authenticated student's orders", async () => {
    const response = await request("?user_id=4");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    const data = await response.json();
    assert.deepEqual(data.map((order) => order.order_id), [12, 11]);
    assert.equal(data[0].queue_number, 4);
    assert.equal(data[0].ordered_at, savedOrders[0].ordered_at);
    assert.equal(data[0].total_amount, "150.00");
});

test("details include saved item prices, quantities, totals, and status", async () => {
    const response = await request("/12");
    assert.equal(response.status, 200);
    const order = await response.json();
    assert.deepEqual(order.items, savedOrders[0].items);
    assert.equal(order.status, "ready");
    assert.equal(order.total_amount, "150.00");
});

test("another student's order and a nonexistent order both return JSON 404", async () => {
    for (const id of [10, 999]) {
        const response = await request(`/${id}`);
        assert.equal(response.status, 404);
        assert.deepEqual(await response.json(), { message: "Order not found" });
    }

    assert.equal((await request("/10", 4)).status, 200);
});

test("list and details reject missing and invalid tokens before querying orders", async () => {
    pool.query = async () => assert.fail("Unauthenticated request queried the database");

    for (const path of ["", "/12"]) {
        assert.equal((await request(path, null)).status, 401);
        const invalid = await fetch(baseUrl + path, {
            headers: { Authorization: "Bearer invalid" }
        });
        assert.equal(invalid.status, 401);
    }
});

test("staff cannot access student order routes", async () => {
    pool.query = async () => assert.fail("Staff request queried student orders");
    assert.equal((await request("", 3, "staff")).status, 403);
    assert.equal((await request("/12", 3, "staff")).status, 403);
});

test("invalid order IDs return JSON 400 before querying the database", async () => {
    pool.query = async () => assert.fail("Invalid ID queried the database");

    for (const id of ["abc", "0", "-1", "1.5", "2147483648"]) {
        const response = await request(`/${id}`);
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { message: "Invalid order ID" });
    }
});

test("empty history returns an empty array", async () => {
    const response = await request("", 5);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
});

test("refresh reads the current status again", async () => {
    const initial = await (await request("/12")).json();
    assert.equal(initial.status, "ready");
    pool.query = async () => ({ rows: [{ ...savedOrders[0], status: "picked_up" }] });
    const refreshed = await (await request("/12")).json();
    assert.equal(refreshed.status, "picked_up");
});

test("database failures return JSON without exposing database details", async () => {
    pool.query = async () => { throw new Error("private database details"); };

    for (const path of ["", "/12"]) {
        const response = await request(path);
        assert.equal(response.status, 500);
        assert.match(response.headers.get("content-type"), /application\/json/);
        assert.doesNotMatch(JSON.stringify(await response.json()), /private database details/);
    }
});
