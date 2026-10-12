const jwt = require("jsonwebtoken");
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).json({
            message: "Authentication Required!!!"
        });
    }

    const parts = authHeader.split(" ");
    if(parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]){
        return res.status(401).json({
            message: "Authentication Required!!!"
        });
    }
    const token = parts [1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            next();

    } catch (error) {
        return res.status(401).json({
            message: "Authentication required!!!"
        });
    }
};
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)){
            return res.status(403).json({
                message: "Forbidden!!!"
            });
        }
        next();
    };

};
module.exports = {
    authenticateToken,
    requireRole
};