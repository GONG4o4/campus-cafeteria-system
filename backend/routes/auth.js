const express = require("express");
const router = express.Router();
const pool = require("../db");
require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;


    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }


    const result = await pool.query(
      `SELECT user_id, fname, lname, email, password, role
       FROM users
       WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }


    const token = jwt.sign(
      { user_id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

   
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        fname: user.fname,
        lname: user.lname,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.post("/register", async (req, res) => {
      try {
     const { fname, lname, email, password } = req.body;
if (!fname || !lname || !email || !password) {
  return res.status(400).json({
    message: "First name, last name, email, and password are required",
  });
}

  const existingUser = await pool.query(
  "SELECT user_id FROM users WHERE email = $1",
  [email]
);

if (existingUser.rows.length > 0) {
  return res.status(409).json({
    message: "Email is already registered",
  });
}
const hashedPassword = await bcrypt.hash(password, 10);
const result = await pool.query(
  `INSERT INTO users (fname, lname, email, password, role)
   VALUES ($1, $2, $3, $4, $5)
   RETURNING user_id, fname, lname, email, role, created_at`,
  [fname, lname, email, hashedPassword, "student"]
);
return res.status(201).json({
  message: "Account created successfully",
  user: result.rows[0],
});
}

   catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
  
});

module.exports = router;