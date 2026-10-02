const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    billImage: {
        type: String, // Path to uploaded image
        default: ""
    },
    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected", "Paid"],
        default: "Pending"
    },
    managerRemark: {
        type: String,
        default: ""
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    paidAt: {
        type: Date
    }
}, { timestamps: true });

module.exports = mongoose.model("Expense", expenseSchema);
