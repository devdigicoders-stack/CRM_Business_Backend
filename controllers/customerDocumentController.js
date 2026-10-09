const CustomerDocument = require("../models/CustomerDocument");
const Lead = require("../models/Lead");

// Upload Document
exports.uploadDocument = async (req, res) => {
    try {
        const { leadId, documentName } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const newDoc = await CustomerDocument.create({
            lead: leadId,
            documentName,
            fileUrl: `/uploads/${req.file.filename}`,
            uploadedBy: req.user.id
        });

        res.status(201).json({ message: "Document uploaded successfully", document: newDoc });
    } catch (error) {
        res.status(500).json({ message: "Error uploading document", error: error.message });
    }
};

// Get Documents
exports.getDocuments = async (req, res) => {
    try {
        let filter = {};
        
        // If Customer, only see their own docs
        if (req.user.role?.name === "Customer") {
            const leads = await Lead.find({ email: req.user.email }).select("_id");
            filter.lead = { $in: leads.map(l => l._id) };
        } else if (req.query.leadId) {
            filter.lead = req.query.leadId; // For admin viewing specific lead
        }

        const documents = await CustomerDocument.find(filter)
            .populate("lead", "customerName email")
            .populate("uploadedBy", "name")
            .sort({ createdAt: -1 });

        res.status(200).json(documents);
    } catch (error) {
        res.status(500).json({ message: "Error fetching documents", error: error.message });
    }
};

// Delete Document (Admin/Ops only)
exports.deleteDocument = async (req, res) => {
    try {
        const doc = await CustomerDocument.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "Document not found" });

        await CustomerDocument.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Document deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting document", error: error.message });
    }
};
