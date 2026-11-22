
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../db");

// Replace the HitPay call before the orders route loads it,
// so tests never contact the real payment provider.
const hitpay = require("../services/hitpay");
let paymentRequests = [];
hitpay.createPaymentRequest = async (orderId, totalAmount) => {
    paymentRequests.push({ orderId, totalAmount });
    return {
        paymentRequestId: "pr_test_" + orderId,
        referenceNumber: "REF-" + orderId,
        checkoutUrl: "https://sandbox.example/checkout/" + orderId
    };
};

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
let restrictions;

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

            if (statement.includes("FROM customer_restrictions")) {
                // Same rule as the real SQL: only active, not-yet-expired rows.
                assert.ok(statement.includes("status = 'active'"));
                assert.ok(statement.includes("ends_at > CURRENT_TIMESTAMP"));
                const now = Date.now();
                const rows = restrictions.filter(r =>
                    r.user_id === params[0] &&
                    r.status === "active" &&
                    r.endsAt > now
                );
                return { rows: rows.map(r => ({ restriction_id: 1, reason: r.reason, ends_at: r.ends_at })) };
            }

            if (statement.includes("FROM no_show_policy")) {
                return {
                    rows: [{
                        pickup_window_minutes: 30,
                        grace_period_minutes: 15,
                        offense_threshold: 3,
                        offense_window_days: 30,
                        restriction_days: 7,
                        policy_version: 2
                    }]
                };
            }

            if (statement.startsWith("INSERT INTO payments")) {
                return { rows: [], rowCount: 1 };
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
                        status: "pending",
                        total_amount: params[1],
                        order_date: params[2]
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

// Adds the checkout acknowledgment unless the test says not to.
function withAck(body) {
    if (body && typeof body === "object" && !("acknowledge_no_show_policy" in body)) {
        return { ...body, acknowledge_no_show_policy: true };
    }
    return body;
}

async function request(body, role = "student") {
    body = withAck(body);
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
    restrictions = [];
    paymentRequests = [];

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
    assert.equal(result.total_amount, "150.00");
    assert.equal(result.checkout_url, "https://sandbox.example/checkout/1");

    // The queue number is given later, by the payment webhook.
    assert.equal(result.queue_number, undefined);
    assert.deepEqual(paymentRequests, [{ orderId: 1, totalAmount: "150.00" }]);

    const orderInsert = queries.find(query =>
        query.statement.startsWith("INSERT INTO orders")
    );

    const itemInsert = queries.find(query =>
        query.statement.startsWith("INSERT INTO order_items")
    );

    // user from the JWT, trusted total, server date, policy version 2.
    // The acknowledgment time is CURRENT_TIMESTAMP in the SQL, not a param.
    assert.deepEqual(orderInsert.params, [
        3, "150.00", "2026-10-24", 2
    ]);
    assert.ok(orderInsert.statement.includes("CURRENT_TIMESTAMP"));

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

test("POST is blocked while the customer has an active no-show restriction", async () => {
    restrictions = [{
        user_id: 3,
        status: "active",
        endsAt: Date.now() + 24 * 60 * 60 * 1000,
        ends_at: "2026-11-29T11:00:00",
        reason: "3 uncollected orders within 30 days"
    }];

    const response = await request({
        items: [{ menu_item_id: 2, quantity: 1 }]
    });

    assert.equal(response.status, 403);

    const result = await response.json();

    assert.equal(result.code, "ORDERING_RESTRICTED");
    assert.equal(result.restriction.ends_at, "2026-11-29T11:00:00");
    assert.match(result.message, /2026-11-29T11:00:00/);

    assert.equal(queries.some(q => q.statement.startsWith("INSERT INTO orders")), false);
    assert.equal(wasExecuted("ROLLBACK"), true);
    assert.equal(wasExecuted("COMMIT"), false);
    assert.equal(releases, 1);
});

test("POST is not blocked by an expired or lifted restriction", async () => {
    restrictions = [
        { user_id: 3, status: "active", endsAt: Date.now() - 60 * 1000, ends_at: "old", reason: "expired" },
        { user_id: 3, status: "lifted", endsAt: Date.now() + 60 * 60 * 1000, ends_at: "x", reason: "lifted" }
    ];
    // Stop right after the order row is inserted so the payment
    // provider is never called from tests.
    failOnItemInsert = true;

    await request({
        items: [{ menu_item_id: 2, quantity: 1 }]
    });

    assert.equal(queries.some(q => q.statement.startsWith("INSERT INTO orders")), true);
});

test("POST is not blocked by another customer's restriction", async () => {
    restrictions = [{
        user_id: 99,
        status: "active",
        endsAt: Date.now() + 60 * 60 * 1000,
        ends_at: "2026-11-29T11:00:00",
        reason: "someone else"
    }];
    failOnItemInsert = true;

    await request({
        items: [{ menu_item_id: 2, quantity: 1 }]
    });

    assert.equal(queries.some(q => q.statement.startsWith("INSERT INTO orders")), true);
});

test("POST without the no-show acknowledgment returns 400", async () => {
    for (const ack of [undefined, false, "true", 1, null]) {
        const body = { items: [{ menu_item_id: 2, quantity: 1 }] };

        if (ack !== undefined) {
            body.acknowledge_no_show_policy = ack;
        } else {
            body.acknowledge_no_show_policy = undefined;
        }

        const response = await request(body);
        const result = await response.json();

        assert.equal(response.status, 400);
        assert.equal(result.code, "NO_SHOW_POLICY_NOT_ACKNOWLEDGED");
    }

    assert.equal(queries.length, 0);
    assert.equal(paymentRequests.length, 0);
});

test("POST ignores a client-supplied acknowledgment time", async () => {
    const response = await request({
        acknowledge_no_show_policy: true,
        no_show_ack_at: "2000-01-01T00:00:00",
        no_show_policy_version: 99,
        items: [{ menu_item_id: 2, quantity: 1 }]
    });

    assert.equal(response.status, 201);

    const orderInsert = queries.find(query =>
        query.statement.startsWith("INSERT INTO orders")
    );

    assert.equal(orderInsert.params.includes("2000-01-01T00:00:00"), false);
    assert.equal(orderInsert.params[3], 2);
});
