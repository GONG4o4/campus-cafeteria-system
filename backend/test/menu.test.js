
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