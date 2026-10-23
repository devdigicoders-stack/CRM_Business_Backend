const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");

// Master Dashboard API - role-based, no special permission needed (everyone can see their own data)
router.get("/master", protect, dashboardController.getMasterDashboard);

module.exports = router;
