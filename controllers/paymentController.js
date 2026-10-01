const Payment = require("../models/Payment");

// Initialize Payment Account (Run when Lead is converted or quotation approved)
exports.initializePayment = async (req, res) => {
    try {
        const { lead, project, totalAmount } = req.body;
        
        const existing = await Payment.findOne({ lead });
        if (existing) {
            return res.status(400).json({ message: "Payment account already exists for this lead" });
        }

        const payment = await Payment.create({
            lead,
            project,
            totalAmount,
            balanceAmount: totalAmount
        });

        res.status(201).json({ message: "Payment account initialized", payment });
    } catch (error) {
        res.status(500).json({ message: "Error initializing payment", error: error.message });
    }
};

// Get All Payments (For Manager/Admin tracking)
exports.getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate("lead", "customerName contactNumber")
            .populate("project", "customerName status");
            
        res.status(200).json(payments);
    } catch (error) {
        res.status(500).json({ message: "Error fetching payments", error: error.message });
    }
};

// Get Payment Details by Lead ID
exports.getPaymentByLeadId = async (req, res) => {
    try {
        const payment = await Payment.findOne({ lead: req.params.leadId })
            .populate("transactions.receivedBy", "name")
            .populate("followUpRemarks.addedBy", "name");
            
        if (!payment) return res.status(404).json({ message: "No payment record found for this lead" });

        res.status(200).json(payment);
    } catch (error) {
        res.status(500).json({ message: "Error fetching payment details", error: error.message });
    }
};

// Add a New Transaction (Receive Money)
exports.addTransaction = async (req, res) => {
    try {
        const { amount, mode, transactionId } = req.body;
        const payment = await Payment.findById(req.params.id);
        
        if (!payment) return res.status(404).json({ message: "Payment record not found" });

        if (Number(amount) > payment.balanceAmount) {
            return res.status(400).json({ message: `Amount exceeds balance. Only ${payment.balanceAmount} is pending.` });
        }

        const transaction = {
            amount: Number(amount),
            mode,
            transactionId,
            receivedBy: req.user.id
        };

        // If file uploaded, add receipt URL
        if (req.file) {
            transaction.receiptUrl = `/uploads/${req.file.filename}`;
        }

        payment.transactions.push(transaction);
        payment.paidAmount += Number(amount); // This will trigger pre-save hook to update balance

        await payment.save();
        res.status(200).json({ message: "Transaction added successfully", payment });
    } catch (error) {
        res.status(500).json({ message: "Error adding transaction", error: error.message });
    }
};

// Add Follow-up Remark
exports.addFollowUpRemark = async (req, res) => {
    try {
        const { text, nextFollowUpDate } = req.body;
        const payment = await Payment.findById(req.params.id);
        
        if (!payment) return res.status(404).json({ message: "Payment record not found" });

        payment.followUpRemarks.push({
            text,
            nextFollowUpDate,
            addedBy: req.user.id
        });

        await payment.save();
        res.status(200).json({ message: "Follow-up remark added", payment });
    } catch (error) {
        res.status(500).json({ message: "Error adding remark", error: error.message });
    }
};
