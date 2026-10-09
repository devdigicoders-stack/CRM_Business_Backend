const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware to verify JWT Token
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            // Get token from header (Bearer <token>)
            token = req.headers.authorization.split(" ")[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || "digicoders_secret_key");

            // Get user from token (Exclude password)
            req.user = await User.findById(decoded.id).select("-password").populate("role");

            next(); // Move to the next function/route
        } catch (error) {
            return res.status(401).json({ message: "Not authorized, token failed" });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }
};

// Middleware for Role Based Access Control (RBAC) - checking permissions
exports.authorizePermission = (requiredPermission) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ message: "Role details not found" });
        }

        // Super Admin Bypass
        if (req.user.role.name === 'Admin') {
            return next();
        }

        // Customer Bypass for own projects and payments
        if (req.user.role.name === 'Customer' && (requiredPermission === 'view_projects' || requiredPermission === 'view_payments')) {
            return next();
        }

        const userPermissions = req.user.role.permissions || [];

        // Check exact permission or overarching manager permission
        const isAllowed = userPermissions.includes(requiredPermission) ||
            (requiredPermission.includes("quotation") && userPermissions.includes("manage_quotations")) ||
            (requiredPermission.includes("lead") && userPermissions.includes("manage_leads")) ||
            (requiredPermission.includes("user") && userPermissions.includes("manage_employees")) ||
            (requiredPermission.includes("role") && userPermissions.includes("manage_employees")) ||
            (requiredPermission.includes("settings") && userPermissions.includes("manage_settings"));

        if (isAllowed) {
            next();
        } else {
            return res.status(403).json({ message: "Access Denied: You do not have permission for this action" });
        }
    };
};
