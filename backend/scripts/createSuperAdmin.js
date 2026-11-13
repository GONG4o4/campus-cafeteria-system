// Creates the first Super Admin account.
//
// The details are read from environment variables so no password is ever
// saved in the code or in git. See docs/super-admin.md for the steps.
//
// It only works when there is no active super admin yet. After that,
// use the Super Admin dashboard to manage roles.

const bcrypt = require("bcrypt");
const pool = require("../db");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
    const email = (process.env.SUPER_ADMIN_EMAIL || "").trim();
    const password = process.env.SUPER_ADMIN_PASSWORD || "";
    const fname = (process.env.SUPER_ADMIN_FNAME || "System").trim();
    const lname = (process.env.SUPER_ADMIN_LNAME || "Admin").trim();

    if (!EMAIL_PATTERN.test(email)) {
        throw new Error("Set SUPER_ADMIN_EMAIL to a valid email address.");
    }

    if (password.length < 12 || password.length > 72) {
        throw new Error("Set SUPER_ADMIN_PASSWORD to 12 to 72 characters.");
    }

    if (!fname || !lname || fname.length > 100 || lname.length > 100) {
        throw new Error("SUPER_ADMIN_FNAME and SUPER_ADMIN_LNAME must be 1 to 100 characters.");
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const admins = await client.query(
            "SELECT user_id FROM users WHERE role = 'super_admin' AND is_active = true"
        );

        if (admins.rows.length > 0) {
            throw new Error("An active super admin already exists. Use the dashboard instead.");
        }

        const existing = await client.query(
            "SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)",
            [email]
        );

        if (existing.rows.length > 0) {
            throw new Error("That email is already registered. Use a different email.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const created = await client.query(
            `INSERT INTO users (fname, lname, email, password, role)
             VALUES ($1, $2, $3, $4, 'super_admin')
             RETURNING user_id`,
            [fname, lname, email, hashedPassword]
        );

        const userId = created.rows[0].user_id;

        await client.query(
            `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details)
             VALUES (NULL, 'create_initial_super_admin', 'user', $1, $2)`,
            [userId, JSON.stringify({ email })]
        );

        await client.query("COMMIT");

        console.log(`Super admin created (user_id ${userId}, ${email}).`);
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

main()
    .catch((error) => {
        console.error("Could not create super admin:", error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
