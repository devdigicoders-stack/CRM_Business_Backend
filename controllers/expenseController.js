const Expense = require("../models/Expense");
const fs = require("fs");
const path = require("path");

// Create a new expense claim (Normal User)
exports.createExpense = async (req, res) => {
    try {
        const { amount, reason } = req.body;
        const employeeId = req.user.id;
        
        let billImage = "";
        if (req.file) {
            billImage = `/uploads/expenses/${req.file.filename}`;
        }

        const expense = await Expense.create({
            employeeId,
            amount: Number(amount),
            reason,
            billImage
        });

        res.status(201).json({ message: "Expense request submitted successfully", expense });
    } catch (error) {
        res.status(500).json({ message: "Error submitting expense", error: error.message });
    }
};

// Get My Expenses (Normal User)
exports.getMyExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find({ employeeId: req.user.id })
            .sort({ createdAt: -1 });

        res.status(200).json(expenses);
    } catch (error) {
        res.status(500).json({ message: "Error fetching your expenses", error: error.message });
    }
};

// Get All Expenses (Admin/Manager)
exports.getAllExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find({})
            .populate("employeeId", "name email employeeId department profileImage")
            .populate("approvedBy", "name")
            .populate("paidBy", "name")
            .sort({ createdAt: -1 });

        res.status(200).json(expenses);
    } catch (error) {
        res.status(500).json({ message: "Error fetching all expenses", error: error.message });
    }
};

// Update Expense Status (Approve / Reject / Pay) (Admin/Manager)
exports.updateExpenseStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, managerRemark } = req.body;
        const adminId = req.user.id;

        const validStatuses = ["Pending", "Approved", "Rejected", "Paid"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({ message: "Expense request not found" });
        }

        expense.status = status;
        if (managerRemark) {
            expense.managerRemark = managerRemark;
        }

        if (status === "Approved" || status === "Rejected") {
            expense.approvedBy = adminId;
        }

        if (status === "Paid") {
            expense.paidBy = adminId;
            expense.paidAt = Date.now();
        }

        await expense.save();

        res.status(200).json({ message: `Expense request marked as ${status}`, expense });
    } catch (error) {
        res.status(500).json({ message: "Error updating expense status", error: error.message });
    }
};
