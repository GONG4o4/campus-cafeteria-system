
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../db");
const orders = require("../routes/orders");

const testSecret = "orders-api-tests-only-secret";
const previousSecret = process.env.JWT_SECRET;
const originalConnect = pool.connect;

let server;
let baseUrl;
let queries;
let releases;
let menuRows;
let failOnItemInsert;

function createToken(role = "student") {
    return jwt.sign(
        { user_id: 3, role },
        testSecret,
        { expiresIn: "1h" }
    );
}

function createMockClient() {
    return {
        async query(sql, params = []) {
            const statement = sql.replace(/\s+/g, " ").trim();

            queries.push({ statement, params });

            if (statement === "BEGIN" ||
                statement === "COMMIT" ||
                statement === "ROLLBACK") {
                return { rows: [] };
            }

            if (statement.includes("FROM menu_items")) {
                return { rows: menuRows };
            }

            if (statement.includes("pg_advisory_xact_lock")) {
                return { rows: [] };
            }

            if (statement.includes("TO_CHAR")) {
                return {
                    rows: [{ order_date: "2026-10-24" }]
                };
            }

            if (statement.includes("MAX(queue_number)")) {
                return {
                    rows: [{ next_number: 1 }]
                };
            }

            if (statement.startsWith("INSERT INTO orders")) {
                return {
                    rows: [{
                        order_id: 1,
                        queue_number: params[1],
                        status: "pending",
                        total_amount: params[2],
                        order_date: params[3]
                    }]
                };
            }

            if (statement.startsWith("INSERT INTO order_items")) {
                if (failOnItemInsert) {
                    throw new Error("Simulated database failure");
                }

                return {
                    rows: [],
                    rowCount: 1
                };
            }

            throw new Error("Unexpected database query");
        },

        release() {
            releases += 1;
        }
    };
}

async function request(body, role = "student") {
    const headers = {
        "Content-Type": "application/json"
    };

    if (role !== null) {
        headers.Authorization = `Bearer ${createToken(role)}`;
    }

    return fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
    });
}

function wasExecuted(statement) {
    return queries.some(query => query.statement === statement);
}

before(async () => {
    process.env.JWT_SECRET = testSecret;

    const app = express();

    app.use(express.json());
    app.use("/api/orders", orders);

    server = app.listen(0, "127.0.0.1");

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
    queries = [];
    releases = 0;
    failOnItemInsert = false;

    menuRows = [{
        menu_item_id: 2,
        price: "75.00",
        is_available: true
    }];

    pool.connect = async () => createMockClient();
});

after(async () => {
    pool.connect = originalConnect;

    await new Promise(resolve => server.close(resolve));

    if (previousSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = previousSecret;
    }
});

test("POST without JWT returns 401", async () => {
    const response = await request({
        items: [{ menu_item_id: 2, quantity: 2 }]
    }, null);

    assert.equal(response.status, 401);
    assert.equal(queries.length, 0);
});

test("POST with staff role returns 403", async () => {
    const response = await request({
        items: [{ menu_item_id: 2, quantity: 2 }]
    }, "staff");

    assert.equal(response.status, 403);
    assert.equal(queries.length, 0);
});

test("POST with empty cart returns 400", async () => {
    const response = await request({
        items: []
    });

    assert.equal(response.status, 400);
    assert.equal(queries.length, 0);
});

test("POST with invalid quantity returns 400", async () => {
    const response = await request({
        items: [{ menu_item_id: 2, quantity: 0 }]
    });

    assert.equal(response.status, 400);
    assert.equal(queries.length, 0);
});

test("POST with duplicate items returns 400", async () => {
    const response = await request({
        items: [
            { menu_item_id: 2, quantity: 1 },
            { menu_item_id: 2, quantity: 2 }
        ]
    });

    assert.equal(response.status, 400);
    assert.equal(queries.length, 0);
});

test("POST creates order using trusted prices and student identity", async () => {
    const response = await request({
        user_id: 999,
        total_amount: "0.01",
        queue_number: 999,
        items: [{
            menu_item_id: 2,
            quantity: 2,
            unit_price: "0.01"
        }]
    });

    assert.equal(response.status, 201);

    const result = await response.json();

    assert.equal(result.order_id, 1);
    assert.equal(result.queue_number, 1);
    assert.equal(result.status, "pending");
    assert.equal(result.total_amount, "150.00");

    const orderInsert = queries.find(query =>
        query.statement.startsWith("INSERT INTO orders")
    );

    const itemInsert = queries.find(query =>
        query.statement.startsWith("INSERT INTO order_items")
    );

    assert.deepEqual(orderInsert.params, [
        3, 1, "150.00", "2026-10-24"
    ]);

    assert.deepEqual(itemInsert.params, [
        1, 2, 2, "75.00", "150.00"
    ]);

    assert.equal(wasExecuted("BEGIN"), true);
    assert.equal(wasExecuted("COMMIT"), true);
    assert.equal(wasExecuted("ROLLBACK"), false);
    assert.equal(releases, 1);
});

test("POST rejects nonexistent menu item", async () => {
    menuRows = [];

    const response = await request({
        items: [{ menu_item_id: 999999, quantity: 1 }]
    });

    assert.equal(response.status, 400);

    assert.equal(wasExecuted("ROLLBACK"), true);
    assert.equal(wasExecuted("COMMIT"), false);
    assert.equal(releases, 1);
});

test("POST rejects unavailable menu item", async () => {
    menuRows = [{
        menu_item_id: 4,
        price: "50.00",
        is_available: false
    }];

    const response = await request({
        items: [{ menu_item_id: 4, quantity: 1 }]
    });

    assert.equal(response.status, 400);

    assert.equal(wasExecuted("ROLLBACK"), true);
    assert.equal(wasExecuted("COMMIT"), false);
    assert.equal(releases, 1);
});

test("POST rolls back when order item insertion fails", async () => {
    failOnItemInsert = true;

    const response = await request({
        items: [{ menu_item_id: 2, quantity: 2 }]
    });

    assert.equal(response.status, 500);

    const result = await response.json();

    assert.equal(result.message, "Failed to create order");

    assert.equal(wasExecuted("BEGIN"), true);
    assert.equal(wasExecuted("ROLLBACK"), true);
    assert.equal(wasExecuted("COMMIT"), false);
    assert.equal(releases, 1);
});
