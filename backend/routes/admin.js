const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

const ROLES = ["student", "cafeteria_staff", "super_admin"];
const SETTINGS = ["allow_registration"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Columns that are safe to send back. Never include the password hash.
const USER_COLUMNS = "user_id, fname, lname, email, role, is_active, created_at";

function parseId(value) {
    if (!/^[1-9]\d*$/.test(value)) {
        return null;
    }

    const id = Number(value);

    if (!Number.isSafeInteger(id) || id > 2147483647) {
        return null;
    }

    return id;
}

function isPlainObject(body) {
    return body && typeof body === "object" && !Array.isArray(body);
}

function hasOnlyKeys(body, keys) {
    const bodyKeys = Object.keys(body);

    if (bodyKeys.length !== keys.length) {
        return false;
    }

    return keys.every((key) => bodyKeys.includes(key));
}

function cleanText(value, maxLength) {
    if (typeof value !== "string") {
        return null;
    }

    const text = value.trim();

    if (text.length === 0 || text.length > maxLength) {
        return null;
    }

    return text;
}

async function addAuditLog(client, actorId, action, targetType, targetId, details) {
    await client.query(
        `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [actorId, action, targetType, targetId, JSON.stringify(details || {})]
    );
}

// Sensitive changes need the admin to type their password again.
async function checkPassword(client, userId, password) {
    if (typeof password !== "string" || password.length === 0 || password.length > 72) {
        return false;
    }

    const result = await client.query(
        "SELECT password FROM users WHERE user_id = $1",
        [userId]
    );

    if (result.rows.length === 0) {
        return false;
    }

    return bcrypt.compare(password, result.rows[0].password);
}

// The JWT can be up to 1 hour old, so check the database to make sure
// the admin is still an active super admin.
async function requireActiveSuperAdmin(req, res, next) {
    try {
        const result = await pool.query(
            "SELECT role, is_active FROM users WHERE user_id = $1",
            [req.user.user_id]
        );

        const user = result.rows[0];

        if (!user || user.role !== "super_admin" || user.is_active !== true) {
            return res.status(403).json({ message: "Forbidden" });
        }

        next();
    } catch (error) {
        console.error("Admin check failed:", error.message);

        return res.status(500).json({ message: "Internal server error" });
    }
}

router.use(authenticateToken, requireRole("super_admin"), requireActiveSuperAdmin);

// GET /api/admin/users?search=
router.get("/users", async (req, res) => {
    let search = req.query.search;

    if (search === undefined) {
        search = "";
    }

    if (typeof search !== "string" || search.length > 100) {
        return res.status(400).json({ message: "Invalid search text." });
    }

    try {
        const result = await pool.query(
            `SELECT ${USER_COLUMNS}
             FROM users
             WHERE $1 = ''
                OR email ILIKE '%' || $1 || '%'
                OR fname ILIKE '%' || $1 || '%'
                OR lname ILIKE '%' || $1 || '%'
             ORDER BY user_id ASC`,
            [search.trim()]
        );

        return res.json(result.rows);
    } catch (error) {
        console.error("Admin list users failed:", error.message);

        return res.status(500).json({ message: "Unable to load users." });
    }
});

// POST /api/admin/staff
router.post("/staff", async (req, res) => {
    const body = req.body;

    if (!isPlainObject(body) || !hasOnlyKeys(body, ["fname", "lname", "email", "password"])) {
        return res.status(400).json({
            message: "First name, last name, email, and password are required."
        });
    }

    const fname = cleanText(body.fname, 100);
    const lname = cleanText(body.lname, 100);
    const email = cleanText(body.email, 100);
    const password = body.password;

    if (!fname || !lname) {
        return res.status(400).json({ message: "Enter a valid first and last name." });
    }

    if (!email || !EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (typeof password !== "string" || password.length < 8 || password.length > 72) {
        return res.status(400).json({ message: "Password must be 8 to 72 characters." });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const existing = await client.query(
            "SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)",
            [email]
        );

        if (existing.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ message: "Email is already registered." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const created = await client.query(
            `INSERT INTO users (fname, lname, email, password, role)
             VALUES ($1, $2, $3, $4, 'cafeteria_staff')
             RETURNING ${USER_COLUMNS}`,
            [fname, lname, email, hashedPassword]
        );

        const user = created.rows[0];

        await addAuditLog(client, req.user.user_id, "create_staff_account", "user", user.user_id, {
            email: user.email
        });

        await client.query("COMMIT");

        return res.status(201).json({
            message: "Cafeteria staff account created.",
            user
        });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});

        if (error.code === "23505") {
            return res.status(409).json({ message: "Email is already registered." });
        }

        console.error("Admin create staff failed:", error.message);

        return res.status(500).json({ message: "Unable to create staff account." });
    } finally {
        client.release();
    }
});

// Shared code for changing a user's role or status.
// "change" is { role } or { is_active }.
async function updateUser(req, res, change) {
    const targetId = parseId(req.params.id);

    if (targetId === null) {
        return res.status(400).json({ message: "Invalid user ID." });
    }

    if (targetId === req.user.user_id) {
        return res.status(403).json({ message: "You cannot change your own account here." });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const passwordOk = await checkPassword(client, req.user.user_id, req.body.current_password);

        if (!passwordOk) {
            await client.query("ROLLBACK");
            return res.status(403).json({ message: "Password confirmation failed." });
        }

        // Lock every active super admin row so two admins cannot
        // remove the last super admin at the same time.
        const admins = await client.query(
            `SELECT user_id FROM users
             WHERE role = 'super_admin' AND is_active = true
             FOR UPDATE`
        );

        const target = await client.query(
            `SELECT ${USER_COLUMNS} FROM users WHERE user_id = $1 FOR UPDATE`,
            [targetId]
        );

        if (target.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "User not found." });
        }

        const user = target.rows[0];
        const newRole = change.role !== undefined ? change.role : user.role;
        const newActive = change.is_active !== undefined ? change.is_active : user.is_active;

        if (newRole === user.role && newActive === user.is_active) {
            await client.query("ROLLBACK");
            return res.status(409).json({ message: "No change was made." });
        }

        const isActiveAdmin = user.role === "super_admin" && user.is_active === true;
        const staysActiveAdmin = newRole === "super_admin" && newActive === true;

        if (isActiveAdmin && !staysActiveAdmin && admins.rows.length <= 1) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                message: "The last active super admin cannot be deactivated or demoted."
            });
        }

        const updated = await client.query(
            `UPDATE users
             SET role = $1, is_active = $2
             WHERE user_id = $3
             RETURNING ${USER_COLUMNS}`,
            [newRole, newActive, targetId]
        );

        let action;
        let details;

        if (change.role !== undefined) {
            action = "change_role";
            details = { email: user.email, from: user.role, to: newRole };
        } else {
            action = newActive ? "activate_account" : "deactivate_account";
            details = { email: user.email };
        }

        await addAuditLog(client, req.user.user_id, action, "user", targetId, details);

        await client.query("COMMIT");

        return res.json({
            message: "User updated.",
            user: updated.rows[0]
        });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});

        console.error("Admin update user failed:", error.message);

        return res.status(500).json({ message: "Unable to update user." });
    } finally {
        client.release();
    }
}

// PATCH /api/admin/users/:id/role
router.patch("/users/:id/role", async (req, res) => {
    const body = req.body;

    if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, ["role", "current_password"]) ||
        !ROLES.includes(body.role)
    ) {
        return res.status(400).json({ message: "Invalid role update request." });
    }

    return updateUser(req, res, { role: body.role });
});

// PATCH /api/admin/users/:id/status
router.patch("/users/:id/status", async (req, res) => {
    const body = req.body;

    if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, ["is_active", "current_password"]) ||
        typeof body.is_active !== "boolean"
    ) {
        return res.status(400).json({ message: "Invalid status update request." });
    }

    return updateUser(req, res, { is_active: body.is_active });
});

// GET /api/admin/reports
router.get("/reports", async (req, res) => {
    try {
        const users = await pool.query(
            `SELECT
                COUNT(*)::int AS total_users,
                COUNT(*) FILTER (WHERE role = 'student')::int AS students,
                COUNT(*) FILTER (WHERE role = 'cafeteria_staff')::int AS staff,
                COUNT(*) FILTER (WHERE role = 'super_admin')::int AS super_admins,
                COUNT(*) FILTER (WHERE is_active = false)::int AS inactive_users
             FROM users`
        );

        const orders = await pool.query(
            `SELECT
                COUNT(*)::int AS total_orders,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                COUNT(*) FILTER (WHERE status = 'preparing')::int AS preparing,
                COUNT(*) FILTER (WHERE status = 'ready')::int AS ready,
                COUNT(*) FILTER (WHERE status = 'picked_up')::int AS picked_up,
                COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
                COALESCE(SUM(total_amount) FILTER (WHERE status <> 'cancelled'), 0) AS total_sales,
                COALESCE(SUM(total_amount) FILTER (WHERE status = 'picked_up'), 0) AS completed_sales
             FROM orders`
        );

        const daily = await pool.query(
            `SELECT
                TO_CHAR(order_date, 'YYYY-MM-DD') AS date,
                COUNT(*)::int AS orders,
                COALESCE(SUM(total_amount) FILTER (WHERE status <> 'cancelled'), 0) AS sales
             FROM orders
             WHERE order_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date - 7
             GROUP BY order_date
             ORDER BY order_date DESC`
        );

        const topItems = await pool.query(
            `SELECT
                mi.name,
                SUM(oi.quantity)::int AS quantity,
                SUM(oi.subtotal) AS sales
             FROM order_items oi
             JOIN orders o ON o.order_id = oi.order_id
             JOIN menu_items mi ON mi.menu_item_id = oi.menu_item_id
             WHERE o.status <> 'cancelled'
             GROUP BY mi.menu_item_id, mi.name
             ORDER BY quantity DESC, mi.name ASC
             LIMIT 5`
        );

        return res.json({
            users: users.rows[0],
            orders: orders.rows[0],
            daily_sales: daily.rows,
            top_items: topItems.rows
        });
    } catch (error) {
        console.error("Admin reports failed:", error.message);

        return res.status(500).json({ message: "Unable to load reports." });
    }
});

// GET /api/admin/audit-logs?limit=
router.get("/audit-logs", async (req, res) => {
    let limit = 50;

    if (req.query.limit !== undefined) {
        limit = parseId(String(req.query.limit));

        if (limit === null || limit > 200) {
            return res.status(400).json({ message: "Limit must be between 1 and 200." });
        }
    }

    try {
        const result = await pool.query(
            `SELECT
                a.audit_log_id,
                a.action,
                a.target_type,
                a.target_id,
                a.details,
                TO_CHAR(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at,
                u.email AS actor_email
             FROM audit_logs a
             LEFT JOIN users u ON u.user_id = a.actor_user_id
             ORDER BY a.created_at DESC, a.audit_log_id DESC
             LIMIT $1`,
            [limit]
        );

        return res.json(result.rows);
    } catch (error) {
        console.error("Admin audit logs failed:", error.message);

        return res.status(500).json({ message: "Unable to load audit logs." });
    }
});

// GET /api/admin/settings
router.get("/settings", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT setting_key, setting_value
             FROM system_settings
             WHERE setting_key = ANY($1)`,
            [SETTINGS]
        );

        const settings = {};

        for (const row of result.rows) {
            settings[row.setting_key] = row.setting_value;
        }

        return res.json(settings);
    } catch (error) {
        console.error("Admin settings failed:", error.message);

        return res.status(500).json({ message: "Unable to load settings." });
    }
});

// PUT /api/admin/settings  body: { allow_registration: true }
router.put("/settings", async (req, res) => {
    const body = req.body;

    if (!isPlainObject(body) || Object.keys(body).length === 0) {
        return res.status(400).json({ message: "Invalid settings request." });
    }

    for (const key of Object.keys(body)) {
        if (!SETTINGS.includes(key) || typeof body[key] !== "boolean") {
            return res.status(400).json({ message: "Invalid settings request." });
        }
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        for (const key of Object.keys(body)) {
            await client.query(
                `INSERT INTO system_settings (setting_key, setting_value, updated_at, updated_by)
                 VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
                 ON CONFLICT (setting_key) DO UPDATE
                 SET setting_value = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3`,
                [key, body[key], req.user.user_id]
            );
        }

        await addAuditLog(client, req.user.user_id, "update_settings", "setting", null, body);

        await client.query("COMMIT");

        return res.json({ message: "Settings saved.", settings: body });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});

        console.error("Admin update settings failed:", error.message);

        return res.status(500).json({ message: "Unable to save settings." });
    } finally {
        client.release();
    }
});

module.exports = router;
