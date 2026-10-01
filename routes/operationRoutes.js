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

// ================= TASKS =================
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

module.exports = router;
