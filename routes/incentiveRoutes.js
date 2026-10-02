const express = require("express");
const router = express.Router();
const incentiveController = require("../controllers/incentiveController");
const { protect, authorizePermission } = require("../middleware/authMiddleware");

// Route to add/deduct incentive balance
router.post("/transaction", protect, authorizePermission("add_incentive"), incentiveController.addIncentive);

// Route to get incentive history for an employee
router.get("/history/:employeeId", protect, incentiveController.getIncentiveHistory);

// Route to get ALL incentive transactions
router.get("/transactions/all", protect, authorizePermission("add_incentive"), incentiveController.getAllTransactions);

module.exports = router;
