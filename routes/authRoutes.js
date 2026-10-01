const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const upload = require("../middleware/upload");

// Protect and RBAC middleware import
const { protect, authorizePermission } = require("../middleware/authMiddleware");

// Register route (Secured: Only Admin or users with 'manage_users' can create accounts)
router.post(
    "/register", 
    protect, 
    authorizePermission("create_user"), 
    upload.single("profileImage"), 
    authController.registerUser
);

// Login route
router.post("/login", authController.loginUser);

// Protected routes (for logged in users)
router.get("/profile", protect, authController.getProfile);
router.put("/profile/edit", protect, upload.single("profileImage"), authController.editProfile);
router.put("/profile/change-password", protect, authController.changePassword);

// Get All Users
router.get("/users", protect, authorizePermission("manage_employees"), authController.getAllUsers);

// Get Assignable Users for Lead Assign Dropdown (Hierarchy-aware, no extra permission needed)


// Admin User Management Routes (Secured: Only Admin/manage_users)
router.put("/users/:id", protect, authorizePermission("edit_user"), upload.single("profileImage"), authController.adminEditUser);
router.delete("/users/:id", protect, authorizePermission("delete_user"), authController.adminDeleteUser);
router.put("/users/:id/status", protect, authorizePermission("edit_user"), authController.adminToggleUserStatus);
router.put("/users/:id/change-password", protect, authorizePermission("edit_user"), authController.adminChangeUserPassword);

module.exports = router;
