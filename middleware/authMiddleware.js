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

        const roleName = req.user.role?.name;

        // Super Admin Bypass
        if (roleName === 'Admin' || roleName === 'Super Admin') {
            return next();
        }

        const permissionsToCheck = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

        // Customer Bypass for own projects and payments
        if (roleName === 'Customer' && (permissionsToCheck.includes('view_projects') || permissionsToCheck.includes('view_payments'))) {
            return next();
        }

        const userPermissions = req.user.role.permissions || [];

        // Check exact permission or overarching manager permission
        const isAllowed = permissionsToCheck.some(perm => 
            userPermissions.includes(perm) ||
            (perm === "manage_hardware" && userPermissions.includes("manage_project_workflow")) ||
            (perm === "view_projects" && userPermissions.includes("manage_hardware")) ||
            (perm.includes("quotation") && userPermissions.includes("manage_quotations")) ||
            (perm.includes("lead") && userPermissions.includes("manage_leads")) ||
            (perm.includes("user") && userPermissions.includes("manage_employees")) ||
            (perm.includes("role") && userPermissions.includes("manage_employees")) ||
            (perm.includes("settings") && userPermissions.includes("manage_settings"))
        );

        if (isAllowed) {
            next();
        } else {
            return res.status(403).json({ message: "Access Denied: You do not have permission for this action" });
        }
    };
};
