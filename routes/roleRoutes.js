const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const { protect, authorizePermission } = require("../middleware/authMiddleware");

// Role APIs (Secured)
// Only users with specific permissions can create, update, or delete roles.
router.post("/create", protect, authorizePermission("create_role"), roleController.createRole);
router.get("/", protect, authorizePermission("view_roles"), roleController.getRoles); // Admin/HR can view roles
router.put("/:id", protect, authorizePermission("edit_role"), roleController.updateRole);
router.delete("/:id", protect, authorizePermission("delete_role"), roleController.deleteRole);

module.exports = router;
