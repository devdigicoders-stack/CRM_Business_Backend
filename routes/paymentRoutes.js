const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const upload = require("../middleware/upload");
const { protect, authorizePermission } = require("../middleware/authMiddleware");

// All routes require login
router.use(protect);

// Initialize a payment account (usually done by Manager/Admin)
router.post("/init", authorizePermission("initialize_payment"), paymentController.initializePayment);

// Get all payments (Manager/Admin to monitor everything)
router.get("/", authorizePermission("view_payments"), paymentController.getAllPayments);

// Get payment detail for a specific lead
router.get("/lead/:leadId", paymentController.getPaymentByLeadId);

// Add a transaction (accept money/receipt upload)
router.post("/:id/transactions", authorizePermission("add_transaction"), upload.single("receipt"), paymentController.addTransaction);

// Add follow-up remark for pending payments
router.put("/:id/follow-up", paymentController.addFollowUpRemark);

module.exports = router;
