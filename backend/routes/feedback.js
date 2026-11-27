const express = require("express");
const pool = require("../db");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

const TYPES = ["feedback", "report"];
const STATUSES = ["new", "resolved"];

function parseId(value) {
    if (!/^[1-9]\d*$/.test(String(value))) {
        return null;
    }

    const id = Number(value);

    if (!Number.isSafeInteger(id) || id > 2147483647) {
        return null;
    }

    return id;
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

const FEEDBACK_COLUMNS = `
    f.feedback_id,
    f.type,
    f.subject,
    f.message,
    f.rating,
    f.order_id,
    f.status,
    TO_CHAR(f.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at,
    TO_CHAR(f.resolved_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS resolved_at`;

router.use(authenticateToken);

// POST /api/feedback  (customers)
// Body: { type, subject, message, rating?, order_id? }
router.post("/", requireRole("student"), async (req, res) => {
    const body = req.body || {};
    const subject = cleanText(body.subject, 120);
    const message = cleanText(body.message, 2000);

    if (!TYPES.includes(body.type)) {
        return res.status(400).json({ message: "Choose feedback or report a problem." });
    }

    if (!subject) {
        return res.status(400).json({ message: "Enter a subject (up to 120 characters)." });
    }

    if (!message) {
        return res.status(400).json({ message: "Enter a message (up to 2000 characters)." });
    }

    let rating = null;

    if (body.rating !== undefined && body.rating !== null) {
        if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
            return res.status(400).json({ message: "Rating must be from 1 to 5." });
        }

        rating = body.rating;
    }

    let orderId = null;

    if (body.order_id !== undefined && body.order_id !== null && body.order_id !== "") {
        orderId = parseId(body.order_id);

        if (orderId === null) {
            return res.status(400).json({ message: "Invalid order number." });
        }
    }

    try {
        // A customer can only link one of their own orders.
        if (orderId !== null) {
            const order = await pool.query(
                "SELECT order_id FROM orders WHERE order_id = $1 AND user_id = $2",
                [orderId, req.user.user_id]
            );

            if (order.rows.length === 0) {
                return res.status(400).json({ message: "That order was not found in your order history." });
            }
        }

        const result = await pool.query(
            `INSERT INTO feedback (user_id, type, subject, message, rating, order_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING feedback_id`,
            [req.user.user_id, body.type, subject, message, rating, orderId]
        );

        return res.status(201).json({
            message: body.type === "report"
                ? "Thank you. Your report was sent to the cafeteria."
                : "Thank you for your feedback!",
            feedback_id: result.rows[0].feedback_id
        });
    } catch (error) {
        console.error("Create feedback failed:", error.message);

        return res.status(500).json({ message: "Unable to send your feedback right now." });
    }
});

// GET /api/feedback/mine  (customers see what they sent)
router.get("/mine", requireRole("student"), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${FEEDBACK_COLUMNS}
             FROM feedback f
             WHERE f.user_id = $1
             ORDER BY f.created_at DESC, f.feedback_id DESC
             LIMIT 50`,
            [req.user.user_id]
        );

        return res.json(result.rows);
    } catch (error) {
        console.error("Load my feedback failed:", error.message);

        return res.status(500).json({ message: "Unable to load your feedback." });
    }
});

// GET /api/feedback?type=&status=  (staff and super admin)
router.get("/", requireRole("cafeteria_staff", "super_admin"), async (req, res) => {
    const type = req.query.type || "";
    const status = req.query.status || "";

    if (type && !TYPES.includes(type)) {
        return res.status(400).json({ message: "Invalid type filter." });
    }

    if (status && !STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status filter." });
    }

    try {
        const result = await pool.query(
            `SELECT ${FEEDBACK_COLUMNS},
                    u.fname,
                    u.lname,
                    u.email
             FROM feedback f
             JOIN users u ON u.user_id = f.user_id
             WHERE ($1::varchar = '' OR f.type = $1::varchar)
               AND ($2::varchar = '' OR f.status = $2::varchar)
             ORDER BY f.created_at DESC, f.feedback_id DESC
             LIMIT 200`,
            [type, status]
        );

        const summary = await pool.query(
            `SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
                COUNT(*) FILTER (WHERE type = 'report' AND status = 'new')::int AS open_reports,
                ROUND(AVG(rating), 1) AS average_rating
             FROM feedback`
        );

        const row = summary.rows[0];

        return res.json({
            items: result.rows,
            summary: {
                total: row.total,
                new_count: row.new_count,
                open_reports: row.open_reports,
                average_rating: row.average_rating === null ? null : Number(row.average_rating)
            }
        });
    } catch (error) {
        console.error("Load feedback failed:", error.message);

        return res.status(500).json({ message: "Unable to load feedback." });
    }
});

// PATCH /api/feedback/:id/status  (staff and super admin)
// Body: { status: "new" | "resolved" }
router.patch("/:id/status", requireRole("cafeteria_staff", "super_admin"), async (req, res) => {
    const id = parseId(req.params.id);
    const status = req.body ? req.body.status : undefined;

    if (id === null) {
        return res.status(400).json({ message: "Invalid feedback ID." });
    }

    if (!STATUSES.includes(status)) {
        return res.status(400).json({ message: "Status must be new or resolved." });
    }

    try {
        const result = await pool.query(
            `UPDATE feedback
             SET status = $1::varchar,
                 resolved_at = CASE WHEN $1::varchar = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END,
                 resolved_by = CASE WHEN $1::varchar = 'resolved' THEN $2::int ELSE NULL END
             WHERE feedback_id = $3
             RETURNING feedback_id, status`,
            [status, req.user.user_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Feedback not found." });
        }

        return res.json(result.rows[0]);
    } catch (error) {
        console.error("Update feedback failed:", error.message);

        return res.status(500).json({ message: "Unable to update feedback." });
    }
});

module.exports = router;
