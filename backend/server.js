const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();

const auth = require("./routes/auth");
const authTest = require("./routes/authTest");
const menu = require("./routes/menu");
const orders = require("./routes/orders")
const staffOrders = require("./routes/staffOrders")

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

app.get("/api/health", (req, res) => {
    res.json({ message: "Backend is working" });
});

app.get("/api/test/protected", authenticateToken, (req, res) => {
    res.json({
        message: "You are Authenticated!!!",
        user: req.user
    });
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