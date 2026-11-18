const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const pool = require("../db");
const admin = require("../routes/admin");

const testSecret = "admin-api-tests-only-secret";
const previousSecret = process.env.JWT_SECRET;
const originalQuery = pool.query;
const originalConnect = pool.connect;

let server;
let baseUrl;
let passwordHash;
let users;
let auditLogs;

// A very small fake database so the tests do not need PostgreSQL.
async function fakeQuery(sql, params = []) {
    const statement = sql.replace(/\s+/g, " ").trim();

    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(statement)) {
        return { rows: [] };
    }

    if (statement.startsWith("SELECT role, is_active FROM users WHERE user_id")) {
        const user = users.find((u) => u.user_id === params[0]);
        return { rows: user ? [{ role: user.role, is_active: user.is_active }] : [] };
    }

    if (statement.startsWith("SELECT password FROM users")) {
        const user = users.find((u) => u.user_id === params[0]);
        return { rows: user ? [{ password: user.password }] : [] };
    }

    if (statement.includes("WHERE role = 'super_admin' AND is_active = true FOR UPDATE")) {
        const rows = users
            .filter((u) => u.role === "super_admin" && u.is_active)
            .map((u) => ({ user_id: u.user_id }));
        return { rows };
    }

    if (statement.includes("FROM users WHERE user_id = $1 FOR UPDATE")) {
        const user = users.find((u) => u.user_id === params[0]);
        return { rows: user ? [publicUser(user)] : [] };
    }

    if (statement.includes("FROM users WHERE $1 = ''")) {
        const search = params[0].toLowerCase();
        const rows = users
            .filter((u) => search === "" || u.email.includes(search) || u.fname.toLowerCase().includes(search))
            .map(publicUser);
        return { rows };
    }

    if (statement.startsWith("SELECT user_id FROM users WHERE LOWER(email)")) {
        const rows = users
            .filter((u) => u.email.toLowerCase() === params[0].toLowerCase())
            .map((u) => ({ user_id: u.user_id }));
        return { rows };
    }

    if (statement.startsWith("INSERT INTO users")) {
        const user = {
            user_id: users.length + 1,
            fname: params[0],
            lname: params[1],
            email: params[2],
            password: params[3],
            role: "cafeteria_staff",
            is_active: true,
            created_at: "2026-11-13T00:00:00.000Z"
        };
        users.push(user);
        return { rows: [publicUser(user)] };
    }

    if (statement.startsWith("UPDATE users SET role")) {
        const user = users.find((u) => u.user_id === params[2]);
        user.role = params[0];
        user.is_active = params[1];
        return { rows: [publicUser(user)] };
    }

    if (statement.startsWith("INSERT INTO audit_logs")) {
        auditLogs.push({
            actor_user_id: params[0],
            action: params[1],
            target_type: params[2],
            target_id: params[3],
            details: JSON.parse(params[4])
        });
        return { rows: [] };
    }

    if (statement.includes("FROM audit_logs")) {
        return { rows: auditLogs.slice(0, params[0]) };
    }

    if (statement.includes("COUNT(*)::int AS total_users")) {
        return { rows: [{ total_users: users.length }] };
    }

    if (statement.includes("COUNT(*)::int AS total_orders")) {
        return { rows: [{ total_orders: 0, total_sales: "0" }] };
    }

    if (statement.includes("GROUP BY order_date") || statement.includes("FROM order_items")) {
        return { rows: [] };
    }

    if (statement.includes("FROM system_settings")) {
        return { rows: [{ setting_key: "allow_registration", setting_value: true }] };
    }

    if (statement.startsWith("INSERT INTO system_settings")) {
        return { rows: [] };
    }

    throw new Error("Unexpected database query: " + statement);
}

function publicUser(user) {
    return {
        user_id: user.user_id,
        fname: user.fname,
        lname: user.lname,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at
    };
}

function createToken(userId, role) {
    return jwt.sign({ user_id: userId, role }, testSecret, { expiresIn: "1h" });
}

async function request(method, path, token, body) {
    const headers = { "Content-Type": "application/json" };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}/api/admin${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    const data = await response.json();

    return { status: response.status, data };
}

const adminToken = () => createToken(1, "super_admin");

before(async () => {
    process.env.JWT_SECRET = testSecret;
    passwordHash = await bcrypt.hash("admin-password", 4);

    const app = express();
    app.use(express.json());
    app.use("/api/admin", admin);

    server = app.listen(0, "127.0.0.1");

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
    users = [
        { user_id: 1, fname: "Super", lname: "Admin", email: "admin@example.com", password: passwordHash, role: "super_admin", is_active: true, created_at: "2026-11-01" },
        { user_id: 2, fname: "Sam", lname: "Student", email: "student@example.com", password: passwordHash, role: "student", is_active: true, created_at: "2026-11-01" },
        { user_id: 3, fname: "Cara", lname: "Staff", email: "staff@example.com", password: passwordHash, role: "cafeteria_staff", is_active: true, created_at: "2026-11-01" },
        { user_id: 4, fname: "Old", lname: "Admin", email: "old-admin@example.com", password: passwordHash, role: "super_admin", is_active: false, created_at: "2026-11-01" }
    ];
    auditLogs = [];

    pool.query = fakeQuery;
    pool.connect = async () => ({ query: fakeQuery, release() {} });
});

after(async () => {
    pool.query = originalQuery;
    pool.connect = originalConnect;

    await new Promise((resolve) => server.close(resolve));

    if (previousSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = previousSecret;
    }
});

// ---------- Access control ----------

test("admin endpoints reject requests without a token", async () => {
    const result = await request("GET", "/users");
    assert.equal(result.status, 401);
});

test("students cannot use admin endpoints", async () => {
    const token = createToken(2, "student");

    for (const [method, path] of [["GET", "/users"], ["GET", "/reports"], ["GET", "/audit-logs"], ["POST", "/staff"], ["PATCH", "/users/3/role"]]) {
        const result = await request(method, path, token, method === "GET" ? undefined : {});
        assert.equal(result.status, 403, `${method} ${path}`);
    }
});

test("cafeteria staff cannot use admin endpoints", async () => {
    const token = createToken(3, "cafeteria_staff");

    for (const [method, path] of [["GET", "/users"], ["GET", "/settings"], ["PATCH", "/users/2/status"]]) {
        const result = await request(method, path, token, method === "GET" ? undefined : {});
        assert.equal(result.status, 403, `${method} ${path}`);
    }
});

test("a deactivated super admin with an old token is rejected", async () => {
    const result = await request("GET", "/users", createToken(4, "super_admin"));
    assert.equal(result.status, 403);
});

test("a demoted user with an old super admin token is rejected", async () => {
    const result = await request("GET", "/users", createToken(2, "super_admin"));
    assert.equal(result.status, 403);
});

// ---------- Users ----------

test("super admin can list users without password hashes", async () => {
    const result = await request("GET", "/users", adminToken());

    assert.equal(result.status, 200);
    assert.equal(result.data.length, 4);

    for (const user of result.data) {
        assert.equal(user.password, undefined);
    }
});

test("user search text is validated", async () => {
    const result = await request("GET", "/users?search=" + "a".repeat(101), adminToken());
    assert.equal(result.status, 400);
});

// ---------- Staff accounts ----------

test("super admin can create a cafeteria staff account", async () => {
    const result = await request("POST", "/staff", adminToken(), {
        fname: "New",
        lname: "Cook",
        email: "cook@example.com",
        password: "cook-password"
    });

    assert.equal(result.status, 201);
    assert.equal(result.data.user.role, "cafeteria_staff");
    assert.equal(result.data.user.password, undefined);
    assert.equal(auditLogs[0].action, "create_staff_account");
    assert.equal(auditLogs[0].actor_user_id, 1);
});

test("staff account creation validates input", async () => {
    const bad = [
        {},
        { fname: "A", lname: "B", email: "not-an-email", password: "long-enough" },
        { fname: "A", lname: "B", email: "a@example.com", password: "short" },
        { fname: " ", lname: "B", email: "a@example.com", password: "long-enough" },
        { fname: "A", lname: "B", email: "a@example.com", password: "long-enough", role: "super_admin" }
    ];

    for (const body of bad) {
        const result = await request("POST", "/staff", adminToken(), body);
        assert.equal(result.status, 400, JSON.stringify(body));
    }

    assert.equal(auditLogs.length, 0);
});

test("staff account creation rejects a duplicate email", async () => {
    const result = await request("POST", "/staff", adminToken(), {
        fname: "Dup",
        lname: "User",
        email: "STUDENT@example.com",
        password: "long-enough"
    });

    assert.equal(result.status, 409);
});

// ---------- Roles ----------

test("super admin can change a user's role with password confirmation", async () => {
    const result = await request("PATCH", "/users/2/role", adminToken(), {
        role: "cafeteria_staff",
        current_password: "admin-password"
    });

    assert.equal(result.status, 200);
    assert.equal(result.data.user.role, "cafeteria_staff");
    assert.deepEqual(auditLogs[0].details, { email: "student@example.com", from: "student", to: "cafeteria_staff" });
});

test("role change fails with the wrong password", async () => {
    const result = await request("PATCH", "/users/2/role", adminToken(), {
        role: "cafeteria_staff",
        current_password: "wrong"
    });

    assert.equal(result.status, 403);
    assert.equal(users[1].role, "student");
});

test("role change validates the role and ID", async () => {
    let result = await request("PATCH", "/users/2/role", adminToken(), { role: "admin", current_password: "admin-password" });
    assert.equal(result.status, 400);

    result = await request("PATCH", "/users/abc/role", adminToken(), { role: "student", current_password: "admin-password" });
    assert.equal(result.status, 400);

    result = await request("PATCH", "/users/99/role", adminToken(), { role: "student", current_password: "admin-password" });
    assert.equal(result.status, 404);
});

test("super admin cannot change their own role", async () => {
    const result = await request("PATCH", "/users/1/role", adminToken(), {
        role: "student",
        current_password: "admin-password"
    });

    assert.equal(result.status, 403);
    assert.equal(users[0].role, "super_admin");
});

// Helper: pretend user 5 is the only active super admin in the locked
// count (for example, another admin was deactivated a moment ago).
function onlyUserFiveIsActiveAdmin() {
    users.push({ user_id: 5, fname: "Second", lname: "Admin", email: "second@example.com", password: passwordHash, role: "super_admin", is_active: true, created_at: "2026-11-01" });

    pool.connect = async () => ({
        async query(sql, params) {
            if (sql.includes("FOR UPDATE") && sql.includes("role = 'super_admin'")) {
                return { rows: [{ user_id: 5 }] };
            }
            return fakeQuery(sql, params);
        },
        release() {}
    });
}

test("another super admin can be demoted while one is still active", async () => {
    users.push({ user_id: 5, fname: "Second", lname: "Admin", email: "second@example.com", password: passwordHash, role: "super_admin", is_active: true, created_at: "2026-11-01" });

    const result = await request("PATCH", "/users/5/role", adminToken(), { role: "student", current_password: "admin-password" });

    assert.equal(result.status, 200);
    assert.equal(users[4].role, "student");
});

test("the last active super admin cannot be demoted", async () => {
    onlyUserFiveIsActiveAdmin();

    const result = await request("PATCH", "/users/5/role", adminToken(), { role: "student", current_password: "admin-password" });

    assert.equal(result.status, 409);
    assert.equal(users[4].role, "super_admin");
    assert.equal(auditLogs.length, 0);
});

test("the last active super admin cannot be deactivated", async () => {
    onlyUserFiveIsActiveAdmin();

    const result = await request("PATCH", "/users/5/status", adminToken(), { is_active: false, current_password: "admin-password" });

    assert.equal(result.status, 409);
    assert.equal(users[4].is_active, true);
});

// ---------- Status ----------

test("super admin can deactivate and reactivate an account", async () => {
    let result = await request("PATCH", "/users/2/status", adminToken(), { is_active: false, current_password: "admin-password" });
    assert.equal(result.status, 200);
    assert.equal(users[1].is_active, false);

    result = await request("PATCH", "/users/2/status", adminToken(), { is_active: true, current_password: "admin-password" });
    assert.equal(result.status, 200);
    assert.equal(users[1].is_active, true);

    assert.deepEqual(auditLogs.map((log) => log.action), ["deactivate_account", "activate_account"]);
});

test("status update validates the body", async () => {
    const result = await request("PATCH", "/users/2/status", adminToken(), { is_active: "no", current_password: "admin-password" });
    assert.equal(result.status, 400);
});

test("super admin cannot deactivate themselves", async () => {
    const result = await request("PATCH", "/users/1/status", adminToken(), { is_active: false, current_password: "admin-password" });
    assert.equal(result.status, 403);
});

test("an unchanged status returns 409", async () => {
    const result = await request("PATCH", "/users/2/status", adminToken(), { is_active: true, current_password: "admin-password" });
    assert.equal(result.status, 409);
});

// ---------- Reports, audit logs, settings ----------

test("super admin can load reports", async () => {
    const result = await request("GET", "/reports", adminToken());

    assert.equal(result.status, 200);
    assert.equal(result.data.users.total_users, 4);
    assert.ok(Array.isArray(result.data.daily_sales));
    assert.ok(Array.isArray(result.data.top_items));
});

test("super admin can load audit logs and the limit is validated", async () => {
    let result = await request("GET", "/audit-logs", adminToken());
    assert.equal(result.status, 200);

    result = await request("GET", "/audit-logs?limit=500", adminToken());
    assert.equal(result.status, 400);
});

test("super admin can read and update approved settings", async () => {
    let result = await request("GET", "/settings", adminToken());
    assert.equal(result.status, 200);
    assert.equal(result.data.allow_registration, true);

    result = await request("PUT", "/settings", adminToken(), { allow_registration: false });
    assert.equal(result.status, 200);
    assert.equal(auditLogs[0].action, "update_settings");
});

test("unknown or invalid settings are rejected", async () => {
    let result = await request("PUT", "/settings", adminToken(), { maintenance_mode: true });
    assert.equal(result.status, 400);

    result = await request("PUT", "/settings", adminToken(), { allow_registration: "yes" });
    assert.equal(result.status, 400);
});

test("database errors do not leak details", async () => {
    pool.query = async (sql, params) => {
        if (sql.includes("SELECT role, is_active")) {
            return fakeQuery(sql, params);
        }
        throw new Error("private database details");
    };

    const result = await request("GET", "/users", adminToken());

    assert.equal(result.status, 500);
    assert.doesNotMatch(JSON.stringify(result.data), /private/);
});
