const mongoose = require("mongoose");

const quotationItemSchema = new mongoose.Schema({
    itemType: { type: String, enum: ["Product", "Service"], required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, required: false }, // Optional for on-the-fly custom items
    name: { type: String, required: true }, // Name of product or service
    description: { type: String, default: "" }, // Extra line item description / features
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    gstPercentage: { type: Number, default: 18 },
    taxAmount: { type: Number, default: 0 }
});

const quotationSchema = new mongoose.Schema({
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    quotationNumber: { type: String, unique: true },
    items: [quotationItemSchema],
    subTotal: { type: Number, required: true },
    taxAmount: { type: Number, required: true }, // Total of all items' taxAmounts
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ["Draft", "Pending Approval", "Approved", "Rejected"], default: "Draft" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Sales Exec
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Manager
    managerRemark: { type: String } // Reason for rejection or notes
}, { timestamps: true });

// Auto-generate a unique quotation number before saving
quotationSchema.pre("save", function() {
    if (!this.quotationNumber) {
        // e.g., QTN-2309-8472
        const datePart = new Date().toISOString().slice(2, 7).replace("-", ""); // YYMM
        const randPart = Math.floor(1000 + Math.random() * 9000); // 4 digit random
        this.quotationNumber = `QTN-${datePart}-${randPart}`;
    }
});

module.exports = mongoose.model("Quotation", quotationSchema);
