const express = require("express");
const router = express.Router();
const operationController = require("../controllers/operationController");
const { protect, authorizePermission } = require("../middleware/authMiddleware");

const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// ================= PROJECTS =================
// Only users with 'manage_operations' (Admin/Ops Head) can create projects
router.post("/projects", protect, authorizePermission("create_project"), operationController.createProject);
router.get("/projects", protect, authorizePermission("view_projects"), operationController.getProjects); 
// Forward project to next workflow stage
router.put("/projects/:id/workflow", protect, authorizePermission("manage_project_workflow"), operationController.forwardProjectWorkflow);
// Get documents related to a project
router.get("/projects/:id/documents", protect, authorizePermission("view_projects"), operationController.getProjectDocuments);
// Get project receipt / invoice data (includes quotation, items, installed equipments with serial numbers)
router.get("/projects/:id/receipt-data", operationController.getProjectReceiptData);
// View project receipt / invoice as official dynamic HTML
router.get("/projects/:id/view-html", operationController.renderProjectInvoiceHTML);

// Save installed equipments / serial numbers (Admin/Ops Head/Hardware manager)
router.put("/projects/:id/equipment", protect, authorizePermission(["manage_hardware", "manage_project_workflow"]), operationController.addInstalledEquipment);
// Assign project to employee/manager (Admin/Ops Head)
router.put("/projects/:id/assign", protect, authorizePermission("manage_project_workflow"), operationController.assignProject);
// Delete project (Super Admin only - verified in controller)
router.delete("/projects/:id", protect, operationController.deleteProject);

// ================= TASKS =================
// Add custom task to project
router.post("/projects/:id/tasks", protect, authorizePermission(["create_task", "manage_project_workflow"]), operationController.addCustomTask);
// Select / Sync template tasks for project
router.post("/projects/:id/select-tasks", protect, authorizePermission(["create_task", "manage_project_workflow"]), operationController.selectProjectTasks);
// Delete task from project
router.delete("/tasks/:id", protect, authorizePermission(["create_task", "manage_project_workflow"]), operationController.deleteTask);

// Assign multiple tasks at once (Ops Head/Admin)
router.put("/tasks/assign-multiple", protect, authorizePermission("create_task"), operationController.assignMultipleTasks);
// Only Ops Head/Admin assigns tasks
router.put("/tasks/:id/assign", protect, authorizePermission("create_task"), operationController.assignTask);
// Employees get their tasks
router.get("/tasks", protect, operationController.getTasks); 
// Employee submits task
router.put("/tasks/:id/submit", protect, upload.any(), operationController.submitTask);
// Ops Head approves task
router.put("/tasks/:id/approve", protect, authorizePermission("manage_project_workflow"), operationController.approveTask);

// Add TAT Remark for Overdue Tasks (Manager/Ops Head Only)
router.put("/tasks/:id/tat-remarks", protect, authorizePermission("add_task_remark"), operationController.addTATRemark);

// TAT Cron Trigger & Email Verification Endpoints
router.post("/tasks/trigger-tat-check", protect, operationController.triggerTATBreachCheck);
router.post("/test-email", protect, operationController.testEmail);

module.exports = router;
