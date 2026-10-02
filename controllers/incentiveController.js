const User = require("../models/User");
const IncentiveTransaction = require("../models/IncentiveTransaction");

// Add or Deduct Incentive Balance
exports.addIncentive = async (req, res) => {
    try {
        const { employeeId, amount, transactionType, remarks } = req.body;

        if (!employeeId || !amount) {
            return res.status(400).json({ message: "Employee ID and Amount are required." });
        }

        const employee = await User.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: "Employee not found." });
        }

        const parsedAmount = Number(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ message: "Invalid amount." });
        }

        const type = transactionType || "CREDIT";

        if (type === "CREDIT") {
            employee.incentiveBalance = (employee.incentiveBalance || 0) + parsedAmount;
        } else if (type === "DEBIT") {
            if ((employee.incentiveBalance || 0) < parsedAmount) {
                return res.status(400).json({ message: "Insufficient incentive balance for debit." });
            }
            employee.incentiveBalance -= parsedAmount;
        } else {
            return res.status(400).json({ message: "Invalid transaction type." });
        }

        await employee.save();

        // Log transaction
        const transaction = await IncentiveTransaction.create({
            employeeId,
            adminId: req.user.id, // Who is doing the action
            amount: parsedAmount,
            transactionType: type,
            remarks
        });

        res.status(200).json({
            message: `Incentive ${type === 'CREDIT' ? 'added' : 'deducted'} successfully.`,
            newBalance: employee.incentiveBalance,
            transaction
        });
    } catch (error) {
        res.status(500).json({ message: "Error updating incentive", error: error.message });
    }
};

// Get Employee's Incentive Transactions
exports.getIncentiveHistory = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const transactions = await IncentiveTransaction.find({ employeeId })
            .populate("adminId", "name email")
            .sort({ createdAt: -1 });

        const employee = await User.findById(employeeId).select("name incentiveBalance");

        res.status(200).json({
            employee,
            transactions
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching incentive history", error: error.message });
    }
};

// Get All Incentive Transactions (Global Ledger)
exports.getAllTransactions = async (req, res) => {
    try {
        const transactions = await IncentiveTransaction.find({})
            .populate("adminId", "name email")
            .populate("employeeId", "name email employeeId department profileImage")
            .sort({ createdAt: -1 });

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: "Error fetching global incentive history", error: error.message });
    }
};
