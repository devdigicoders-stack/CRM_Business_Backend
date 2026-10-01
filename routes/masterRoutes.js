const express = require("express");
const router = express.Router();
const masterController = require("../controllers/masterController");
const settingsController = require("../controllers/settingsController");
const productController = require("../controllers/productController");
const taskTemplateController = require("../controllers/taskTemplateController");
const { protect, authorizePermission } = require("../middleware/authMiddleware");


// ======================= DEPARTMENTS ROUTES =======================
// Only users with 'manage_settings' permission can create, update, delete
router.post("/departments", protect, authorizePermission("create_department"), masterController.createDepartment);
router.put("/departments/:id", protect, authorizePermission("edit_department"), masterController.updateDepartment);
router.delete("/departments/:id", protect, authorizePermission("delete_department"), masterController.deleteDepartment);
router.get("/departments", protect, masterController.getDepartments);

// ======================= DOCUMENT TYPES =======================
router.post("/document-types", protect, authorizePermission("manage_settings"), masterController.createDocumentType);
router.get("/document-types", protect, masterController.getDocumentTypes);
router.put("/document-types/:id", protect, authorizePermission("manage_settings"), masterController.updateDocumentType);
router.delete("/document-types/:id", protect, authorizePermission("manage_settings"), masterController.deleteDocumentType);

// ======================= SETTINGS ROUTES =======================
router.get("/settings", protect, settingsController.getSettings);
router.put("/settings", protect, authorizePermission("update_settings"), settingsController.updateSettings);

// ======================= PRODUCTS =======================
router.post("/products", protect, authorizePermission("manage_products"), productController.createProduct);
router.get("/products", protect, productController.getProducts);
router.put("/products/:id", protect, authorizePermission("manage_products"), productController.updateProduct);
router.delete("/products/:id", protect, authorizePermission("manage_products"), productController.deleteProduct);

// ======================= TASK TEMPLATES ROUTES =======================
router.post("/task-templates", protect, authorizePermission("manage_settings"), taskTemplateController.createTaskTemplate);
router.get("/task-templates", protect, taskTemplateController.getTaskTemplates);
router.put("/task-templates/:id", protect, authorizePermission("manage_settings"), taskTemplateController.updateTaskTemplate);
router.delete("/task-templates/:id", protect, authorizePermission("manage_settings"), taskTemplateController.deleteTaskTemplate);

module.exports = router;
