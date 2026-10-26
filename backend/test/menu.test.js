
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../db");
const menu = require("../routes/menu");

const testSecret = "menu-api-tests-only-secret";
const previousSecret = process.env.JWT_SECRET;
const originalQuery = pool.query;

let server;
let baseUrl;

before(async () => {
    process.env.JWT_SECRET = testSecret;

    const app = express();
    app.use(express.json());
    app.use("/api/menu", menu);

    server = app.listen(0, "127.0.0.1");

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
    pool.query = async () => {
        throw new Error("Unexpected database query");
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

function createToken(role) {
    return jwt.sign(
        { user_id: 1, role },
        testSecret,
        { expiresIn: "1h" }
    );
}

async function request(method, path, role = null, body = undefined) {
    const options = {
        method,
        headers: {}
    };

    if (role) {
        options.headers.Authorization = `Bearer ${createToken(role)}`;
    }

    if (body !== undefined) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    return fetch(baseUrl + path, options);
}

const validItem = {
    name: "Chicken Adobo",
    description: "Chicken cooked in soy sauce and vinegar",
    price: 75,
    is_available: true
};

test("GET /api/menu returns menu items", async () => {
    pool.query = async () => ({
        rows: [{ menu_item_id: 1, ...validItem }]
    });

    const response = await request("GET", "/api/menu");

    assert.equal(response.status, 200);

    const items = await response.json();
    assert.equal(items.length, 1);
    assert.equal(items[0].name, "Chicken Adobo");
});

test("GET /api/menu/:id returns an existing item", async () => {
    pool.query = async () => ({
        rows: [{ menu_item_id: 1, ...validItem }]
    });

    const response = await request("GET", "/api/menu/1");

    assert.equal(response.status, 200);

    const item = await response.json();
    assert.equal(item.menu_item_id, 1);
});

test("GET nonexistent item returns 404", async () => {
    pool.query = async () => ({ rows: [] });

    const response = await request("GET", "/api/menu/999999");

    assert.equal(response.status, 404);
});

test("GET invalid ID returns 400", async () => {
    const response = await request("GET", "/api/menu/abc");

    assert.equal(response.status, 400);
});

test("POST without JWT returns 401", async () => {
    const response = await request(
        "POST", "/api/menu", null, validItem
    );

    assert.equal(response.status, 401);
});

test("POST with student role returns 403", async () => {
    const response = await request(
        "POST", "/api/menu", "student", validItem
    );

    assert.equal(response.status, 403);
});

test("POST with cafeteria_staff returns 201", async () => {
    pool.query = async (sql, params) => {
        assert.match(sql, /INSERT INTO menu_items/);
        assert.equal(params[0], "Chicken Adobo");

        return {
            rows: [{ menu_item_id: 1, ...validItem }]
        };
    };

        const response = await request(
        "POST", "/api/menu", "cafeteria_staff", validItem
    );

    assert.equal(response.status, 201);

    const data = await response.json();
    assert.equal(data.item.name, "Chicken Adobo");
});

test("POST with negative price returns 400", async () => {
    const response = await request(
        "POST",
        "/api/menu",
        "cafeteria_staff",
        { ...validItem, price: -50 }
    );

    assert.equal(response.status, 400);
});

test("PUT with cafeteria_staff returns 200", async () => {
    pool.query = async (sql, params) => {
        assert.match(sql, /UPDATE menu_items/);
        assert.equal(params[4], 1);

        return {
            rows: [{ menu_item_id: 1, ...validItem, price: 85 }]
        };
    };

    const response = await request(
        "PUT",
        "/api/menu/1",
        "cafeteria_staff",
        { ...validItem, price: 85 }
    );

    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.item.price, 85);
});

test("PUT nonexistent item returns 404", async () => {
    pool.query = async () => ({ rows: [] });

    const response = await request(
        "PUT",
        "/api/menu/999999",
        "cafeteria_staff",
        validItem
    );

    assert.equal(response.status, 404);
});

test("DELETE with student role returns 403", async () => {
    const response = await request(
        "DELETE", "/api/menu/1", "student"
    );

    assert.equal(response.status, 403);
});

test("DELETE with cafeteria_staff returns 200", async () => {
    pool.query = async (sql, params) => {
        assert.match(sql, /DELETE FROM menu_items/);
        assert.equal(params[0], 1);

        return {
            rows: [{ menu_item_id: 1, ...validItem }]
        };
    };

    const response = await request(
        "DELETE", "/api/menu/1", "cafeteria_staff"
    );

    assert.equal(response.status, 200);
});

test("DELETE item referenced by orders returns 409", async () => {
    pool.query = async () => {
        const error = new Error("Foreign key violation");
        error.code = "23503";
        throw error;
    };

    const response = await request(
        "DELETE", "/api/menu/1", "cafeteria_staff"
    );

    assert.equal(response.status, 409);
});

const invalidMeals = [
    ["missing name", { name: undefined }],
    ["blank name", { name: "   " }],
    ["name longer than 100 characters", { name: "a".repeat(101) }],
    ["missing price", { price: undefined }],
    ["empty price", { price: "" }],
    ["negative price", { price: "-1" }],
    ["too many decimal places", { price: "12.345" }],
    ["price above the database limit", { price: "100000000" }],
    ["scientific notation", { price: "1e2" }],
    ["non-numeric price", { price: "NaN" }],
    ["null price", { price: null }],
    ["boolean price", { price: true }],
    ["invalid description", { description: [] }],
    ["non-boolean availability", { is_available: "false" }],
];

for (const [method, path] of [["POST", "/api/menu"], ["PUT", "/api/menu/1"]]) {
    for (const [label, changes] of invalidMeals) {
        test(`${method} rejects ${label} before querying the database`, async () => {
            const response = await request(
                method, path, "cafeteria_staff", { ...validItem, ...changes }
            );

            assert.equal(response.status, 400);
            assert.equal((await response.json()).message, "Invalid menu item information");
        });
    }

    for (const role of [null, "student", "staff", "admin"]) {
        test(`${method} rejects menu changes from ${role || "guests"}`, async () => {
            const response = await request(method, path, role, validItem);
            assert.equal(response.status, role ? 403 : 401);
        });
    }

    for (const price of ["0", "99999999.99"]) {
        test(`${method} accepts valid boundary price ${price} and trims the name`, async () => {
            pool.query = async (sql, params) => {
                assert.equal(params[0], validItem.name);
                assert.equal(params[2], price);
                return { rows: [{ menu_item_id: 1, ...validItem, price }] };
            };

            const response = await request(method, path, "cafeteria_staff", {
                ...validItem, name: `  ${validItem.name}  `, price
            });
            assert.equal(response.status, method === "POST" ? 201 : 200);
        });
    }
}

test("availability changes update the menu without deleting meals or changing order totals", async () => {
    pool.query = async (sql, params) => {
        assert.match(sql, /UPDATE menu_items/);
        assert.doesNotMatch(sql, /DELETE|UPDATE\s+orders|UPDATE\s+order_items/i);
        assert.deepEqual(params, [validItem.name, validItem.description, "75", false, 1]);
        return { rows: [{ menu_item_id: 1, ...validItem, is_available: false }] };
    };

    const response = await request("PUT", "/api/menu/1", "cafeteria_staff", {
        ...validItem, is_available: false
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).item.is_available, false);
});

test("menu update database errors return a generic JSON error", async () => {
    pool.query = async () => {
        throw new Error("private database details");
    };
    const response = await request("PUT", "/api/menu/1", "cafeteria_staff", validItem);
    assert.equal(response.status, 500);
    const data = await response.json();
    assert.equal(data.message, "Failed to update menu item");
    assert.doesNotMatch(JSON.stringify(data), /private database details/);
});
