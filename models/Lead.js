const mongoose = require("mongoose");

const remarkSchema = new mongoose.Schema({
    text: { type: String, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    date: { type: Date, default: Date.now }
});

const leadSchema = new mongoose.Schema({
    customerName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String },
    companyName: { type: String }, // Customer's company
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Added createdBy
    source: { type: String, enum: ["Website", "JustDial", "Reference", "Facebook", "Cold Call", "Instagram", "Google", "Other"], default: "Other" },
    status: { type: String, enum: ["Pending", "New", "Contacted", "Interested", "Follow-up", "Follow Up", "Quotation Pending", "Quotation Sent", "Quotation Approved", "Quotation Rejected", "Negotiation", "Closed-Won", "Closed-Lost", "Rejected", "Approved"], default: "Pending" },
    remarks: [remarkSchema],
    nextFollowUpDate: { type: Date }, // For scheduling the next call/meeting
    documents: [{
        documentType: { type: String, required: true },
        fileName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        uploadedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        verifiedAt: { type: Date },
        remarks: { type: String }
    }],
    isConverted: { type: Boolean, default: false },
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation" }
}, { timestamps: true });

module.exports = mongoose.model("Lead", leadSchema);
