const express = require("express");
const pool = require("./db");
require("dotenv").config();
const auth = require("./routes/auth");
const app = express();

app.use(express.json());
app.use("/api/auth", auth);

app.get("/api/health", (req, res) => {
  res.json({ message: "Backend is working" });
});


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
