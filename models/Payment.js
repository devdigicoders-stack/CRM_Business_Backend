const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    mode: { type: String, enum: ["Cash", "Online", "Cheque", "Other"], required: true },
    transactionId: { type: String }, // e.g., UPI ref no or cheque no
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiptUrl: { type: String } // optional receipt image
});

const paymentRemarkSchema = new mongoose.Schema({
    text: { type: String, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    date: { type: Date, default: Date.now },
    nextFollowUpDate: { type: Date } // e.g., client says "Call me on Monday"
});

const paymentSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" }, // Optional initially, mandatory if project is created
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    
    totalAmount: { type: Number, required: true }, // From Quotation
    paidAmount: { type: Number, default: 0 },
    balanceAmount: { type: Number, required: true },

    status: { type: String, enum: ["Pending", "Partial", "Completed"], default: "Pending" },
    
    transactions: [transactionSchema],
    followUpRemarks: [paymentRemarkSchema]
}, { timestamps: true });

// Pre-save hook to automatically update balance and status
paymentSchema.pre("save", function() {
    this.balanceAmount = this.totalAmount - this.paidAmount;
    
    if (this.paidAmount >= this.totalAmount) {
        this.status = "Completed";
        this.balanceAmount = 0; // Avoid floating point bugs
    } else if (this.paidAmount > 0) {
        this.status = "Partial";
    } else {
        this.status = "Pending";
    }
});

module.exports = mongoose.model("Payment", paymentSchema);
