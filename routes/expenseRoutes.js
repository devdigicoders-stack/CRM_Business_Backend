const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseController");
const { protect, authorizePermission } = require("../middleware/authMiddleware");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, "../uploads/expenses");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Routes for normal users
router.post("/", protect, upload.single("billImage"), expenseController.createExpense);
router.get("/my", protect, expenseController.getMyExpenses);

// Routes for Admin / Managers
router.get("/all", protect, authorizePermission("manage_expenses"), expenseController.getAllExpenses);
router.put("/:id/status", protect, authorizePermission("manage_expenses"), expenseController.updateExpenseStatus);

module.exports = router;
