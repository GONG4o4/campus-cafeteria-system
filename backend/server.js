const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();

const auth = require("./routes/auth");
const authTest = require("./routes/authTest");
const menu = require("./routes/menu");
const orders = require("./routes/orders")
const staffOrders = require("./routes/staffOrders")
const admin = require("./routes/admin");

const {
    authenticateToken,
    requireRole
} = require("./middleware/authMiddleware");

const app = express();
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());


app.use("/api/auth", auth);
app.use("/api/auth", authTest);
app.use("/api/menu", menu);
app.use("/api/orders", orders);
app.use("/api/staff", staffOrders);
app.use("/api/admin", admin);

app.get("/api/health", (req, res) => {
    res.json({ message: "Backend is working" });
});

app.get("/api/test/protected", authenticateToken, async (req, res) => {
    try {
        // Make sure the account was not deactivated or given a new role
        // after this token was created.
        const result = await pool.query(
            "SELECT role, is_active FROM users WHERE user_id = $1",
            [req.user.user_id]
        );

        const user = result.rows[0];

        if (!user || user.is_active === false || user.role !== req.user.role) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        res.json({
            message: "You are Authenticated!!!",
            user: req.user
        });
    } catch (error) {
        console.error("Session check failed:", error.message);

        res.status(500).json({ message: "Internal server error" });
    }
});

app.get(
    "/api/test/staff-only",
    authenticateToken,
    requireRole("cafeteria_staff"),
    (req, res) => {
        res.json({
            message: "Welcome, Staff!!!"
        });
    }
);

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

pool.query("SELECT NOW()", (err, result) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Database connected!");
        console.log("Database time:", result.rows[0].now);
    }
});