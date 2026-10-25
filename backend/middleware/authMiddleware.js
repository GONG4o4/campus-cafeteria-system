const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
    const authHeader = req.get("Authorization");

    if (!authHeader) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    const parts = authHeader.split(" ");
    const token = parts[1];

    if (
        parts.length !== 2 ||
        parts[0].toLowerCase() !== "bearer" ||
        !token
    ) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            message: "Internal server error"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"]
        });

        if (
            !decoded ||
            typeof decoded !== "object" ||
            !Number.isInteger(decoded.user_id) ||
            decoded.user_id <= 0 ||
            typeof decoded.role !== "string" ||
            !Number.isInteger(decoded.exp)
        ) {
            return res.status(401).json({
                message: "Unauthorized"
            });
        }

        req.user = {
            user_id: decoded.user_id,
            role: decoded.role
        };

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }
};

const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                message: "Unauthorized"
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Forbidden"
            });
        }

        next();
    };
};

module.exports = {
    authenticateToken,
    requireRole,


    authenticate: authenticateToken,
    authorizeRoles: requireRole
};