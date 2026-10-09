const express = require("express");
const router = express.Router();
const customerDocumentController = require("../controllers/customerDocumentController");
const { protect } = require("../middleware/authMiddleware");

const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({ storage });

// Upload Document (Admin/Ops head will use this)
router.post("/", protect, upload.single("file"), customerDocumentController.uploadDocument);

// Get Documents (Filtered by role in controller)
router.get("/", protect, customerDocumentController.getDocuments);

// Delete Document
router.delete("/:id", protect, customerDocumentController.deleteDocument);

module.exports = router;
