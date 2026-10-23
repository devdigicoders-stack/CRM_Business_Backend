const mongoose = require("mongoose");

const incentiveTransactionSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    transactionType: {
        type: String,
        enum: ["CREDIT", "DEBIT"], // CREDIT = add incentive, DEBIT = deduct or payout
        default: "CREDIT"
    },
    remarks: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model("IncentiveTransaction", incentiveTransactionSchema);
