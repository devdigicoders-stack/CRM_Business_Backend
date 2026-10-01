const express = require("express");
const router = express.Router();
const leadController = require("../controllers/leadController");
const quotationController = require("../controllers/quotationController");
const { protect, authorizePermission } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

// Create Lead (Requires manage_leads permission)
router.post("/leads", protect, authorizePermission("create_lead"), upload.array("documents", 10), leadController.createLead);
// Bulk Create Leads route removed
// View All Leads
router.get("/leads", protect, authorizePermission("view_leads"), leadController.getLeads);
// View Closed Won Leads Only
router.get("/leads/closed-won/all", protect, authorizePermission("view_closed_won"), leadController.getClosedWonLeads);
// View Single Lead
router.get("/leads/:id", protect, leadController.getLeadById);
// Update Lead (Add follow-ups, change status)
router.put("/leads/:id", protect, leadController.updateLead);
// Delete Lead (Admin only)
router.delete("/leads/:id", protect, authorizePermission("manage_leads"), leadController.deleteLead);
// Convert Lead to Final Customer
router.post("/leads/:id/convert", protect, authorizePermission("convert_lead"), leadController.convertLead);

// ======================= LEAD DOCUMENTS =======================
// Upload Document
router.post("/leads/:id/documents", protect, authorizePermission("upload_documents"), upload.single("documents"), leadController.uploadLeadDocument);

// Get Documents
router.get("/leads/:id/documents", protect, leadController.getLeadDocuments);
// Verify/Reject Document (Manager/Admin Only)
router.put("/leads/:id/documents/verify", protect, authorizePermission("verify_documents"), leadController.verifyDocument);

// ======================= QUOTATIONS =======================
// Create Quotation (Sales Exec)
router.post("/quotations", protect, authorizePermission("create_quotation"), quotationController.createQuotation);
// View All Quotations
router.get("/quotations", protect, authorizePermission("view_quotations"), quotationController.getQuotations);
// Public View Quotation (No Login Required - for WhatsApp / Email link)
router.get("/quotations/public/:quotationNumber", quotationController.getPublicQuotation);
// View Single Quotation
router.get("/quotations/:id", protect, quotationController.getQuotationById);
// Update Quotation (Sales Exec / Manager / Admin)
router.put("/quotations/:id", protect, quotationController.updateQuotation);
// Delete Quotation (Sales Exec / Manager / Admin)
router.delete("/quotations/:id", protect, quotationController.deleteQuotation);
// Approve/Reject Quotation (Manager/Admin Only - requires manage_quotations permission)
router.put("/quotations/:id/review", protect, authorizePermission("manage_quotations"), quotationController.reviewQuotation);

module.exports = router;
