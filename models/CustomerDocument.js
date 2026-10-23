const mongoose = require("mongoose");

const customerDocumentSchema = new mongoose.Schema({
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    documentName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

module.exports = mongoose.model("CustomerDocument", customerDocumentSchema);
