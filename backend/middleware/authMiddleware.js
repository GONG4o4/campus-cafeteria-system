const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const authHeader = req.get("Authorization");
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const parts = authHeader.split(" ");
  const token = parts[1];
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer" || !token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "Internal server error" });
  }

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!user || typeof user !== "object") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!Number.isInteger(user.user_id) || user.user_id <= 0) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (typeof user.role !== "string" || !Number.isInteger(user.exp)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = {
    user_id: user.user_id,
    role: user.role,
  };
  return next();
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}

module.exports = { authenticate, authorizeRoles };
