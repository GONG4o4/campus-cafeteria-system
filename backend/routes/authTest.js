const express = require("express");
const { authenticate, requireRole } = require("../middleware/authMiddleware");
const router = express.Router();

function developmentOnly(req, res, next) {
    if (process.env.NODE_ENV !== "development") {
        return res.sendStatus(404);
    }

    return next();
}

router.get("/test", developmentOnly, authenticate, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;