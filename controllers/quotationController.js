const mongoose = require("mongoose");
const Quotation = require("../models/Quotation");
const Settings = require("../models/Settings");
const Lead = require("../models/Lead");
const User = require("../models/User");

// Create Quotation (By Sales Executive)
exports.createQuotation = async (req, res) => {
    try {
        const { leadId, items, subTotal } = req.body;

        if (!leadId) {
            return res.status(400).json({ message: "Please select a Customer / Lead" });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Please add at least one product or service" });
        }

        // Check if a quotation already exists for this lead
        const existingQuotation = await Quotation.findOne({ lead: leadId });
        if (existingQuotation) {
            return res.status(400).json({ message: "A Quotation already exists for this Lead. You can only create one quotation per lead." });
        }

        // Calculate SubTotal and Taxes per item
        let calcSubTotal = 0;
        let taxAmount = 0;
        
        items.forEach(item => {
            const itemSub = Number(item.price || 0) * Number(item.quantity || 1);
            const itemGst = item.gstPercentage !== undefined ? Number(item.gstPercentage) : 18;
            const itemTax = (itemSub * itemGst) / 100;
            
            item.taxAmount = itemTax;
            item.gstPercentage = itemGst;
            
            calcSubTotal += itemSub;
            taxAmount += itemTax;
        });

        const totalAmount = calcSubTotal + taxAmount;

        const quotation = await Quotation.create({
            lead: leadId,
            items,
            subTotal: calcSubTotal,
            taxAmount,
            totalAmount,
            createdBy: req.user.id,
            status: "Pending Approval" // Will go to manager
        });

        // Update Lead Status
        await Lead.findByIdAndUpdate(leadId, { status: "Quotation Pending" });

        await quotation.populate("lead", "customerName companyName contactNumber email status");
        await quotation.populate("createdBy", "name email");

        res.status(201).json({ message: "Quotation generated and sent for approval", quotation });
    } catch (error) {
        res.status(500).json({ message: "Error generating quotation", error: error.message });
    }
};

// Review Quotation (By Sales Manager / Admin)
exports.reviewQuotation = async (req, res) => {
    try {
        const { status, managerRemark } = req.body; // 'Approved' or 'Rejected'

        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) return res.status(404).json({ message: "Quotation not found" });

        quotation.status = status;
        quotation.managerRemark = managerRemark;
        quotation.approvedBy = req.user.id;

        await quotation.save();

        // Auto-update lead status based on approval
        if (status === 'Approved') {
            // When approved → lead moves to "New" (ready for next steps)
            await Lead.findByIdAndUpdate(quotation.lead, { status: 'Quotation Approved' });
        } else if (status === 'Rejected') {
            // When rejected → lead goes to "Rejected"
            await Lead.findByIdAndUpdate(quotation.lead, { status: 'Quotation Rejected' });
        }

        res.status(200).json({ message: `Quotation ${status} successfully`, quotation });
    } catch (error) {
        res.status(500).json({ message: "Error reviewing quotation", error: error.message });
    }
};

// Get All Quotations
exports.getQuotations = async (req, res) => {
    try {
        let filter = {};
        const userRole = req.user.role?.name;

        // Hierarchy Filtering
        if (userRole === "Admin" || userRole === "Operation Head") {
            // Admin and Ops Head see all, no restriction
        } else if (userRole === "Sales Manager") {
            // Manager sees their own + children's quotations
            const children = await User.find({ reportingManager: req.user.id }).select("_id");
            const allowedIds = children.map(u => u._id.toString());
            allowedIds.push(req.user.id.toString());
            filter.createdBy = { $in: allowedIds };
        } else {
            // Staff / Executive sees only their own
            filter.createdBy = req.user.id;
        }

        const quotations = await Quotation.find(filter)
            .sort({ createdAt: -1 })
            .populate("lead", "customerName companyName contactNumber email status")
            .populate("createdBy", "name")
            .populate("approvedBy", "name");

        res.status(200).json(quotations);
    } catch (error) {
        res.status(500).json({ message: "Error fetching quotations", error: error.message });
    }
};

// Get Single Quotation by ID
exports.getQuotationById = async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id)
            .populate("lead", "customerName companyName contactNumber email status")
            .populate("createdBy", "name")
            .populate("approvedBy", "name")
            .populate("items.itemId", "name productCode serviceCode description");

        if (!quotation) return res.status(404).json({ message: "Quotation not found" });

        // Security check
        const userRole = req.user.role?.name;
        if (userRole !== "Admin" && userRole !== "Operation Head") {
            if (userRole === "Sales Manager") {
                const children = await User.find({ reportingManager: req.user.id }).select("_id");
                const allowedIds = children.map(u => u._id.toString());
                allowedIds.push(req.user.id.toString());
                
                if (!allowedIds.includes(quotation.createdBy._id.toString())) {
                    return res.status(403).json({ message: "Access Denied: Quotation belongs to another team" });
                }
            } else {
                if (quotation.createdBy._id.toString() !== req.user.id) {
                    return res.status(403).json({ message: "Access Denied: Not your quotation" });
                }
            }
        }
        res.status(200).json(quotation);
    } catch (error) { res.status(500).json({ message: "Error fetching quotation", error: error.message }); }
};

// Update Quotation (By Sales Executive / Manager / Admin)
exports.updateQuotation = async (req, res) => {
    try {
        const { leadId, items, subTotal, status, managerRemark } = req.body;
        const quotation = await Quotation.findById(req.params.id);

        if (!quotation) {
            return res.status(404).json({ message: "Quotation not found" });
        }

        // Security check: Admin, Sales Manager, or Creator
        const isAdminOrManager = req.user.role?.name === "Admin" || req.user.role?.name === "Sales Manager";
        if (!isAdminOrManager && quotation.createdBy?.toString() !== req.user.id) {
            return res.status(403).json({ message: "Access Denied: You cannot edit this quotation" });
        }

        if (leadId) {
            quotation.lead = leadId;
        }

        if (items && Array.isArray(items) && items.length > 0) {
            quotation.items = items;

            // Recalculate tax and totals per item
            let calcSubTotal = 0;
            let taxAmount = 0;

            items.forEach(item => {
                const itemSub = Number(item.price || 0) * Number(item.quantity || 1);
                const itemGst = item.gstPercentage !== undefined ? Number(item.gstPercentage) : 18;
                const itemTax = (itemSub * itemGst) / 100;
                
                item.taxAmount = itemTax;
                item.gstPercentage = itemGst;
                
                calcSubTotal += itemSub;
                taxAmount += itemTax;
            });

            const totalAmount = calcSubTotal + taxAmount;

            quotation.subTotal = calcSubTotal;
            quotation.taxAmount = taxAmount;
            quotation.totalAmount = totalAmount;
        }

        // If quotation was rejected and creator edits it, reset to Pending Approval
        if (quotation.status === "Rejected" && !isAdminOrManager) {
            quotation.status = "Pending Approval";
            quotation.managerRemark = "";
            // Also reset lead status to Quotation Pending
            await Lead.findByIdAndUpdate(quotation.lead, { status: "Quotation Pending" });
        } else if (status) {
            quotation.status = status;
        }

        if (managerRemark !== undefined) {
            quotation.managerRemark = managerRemark;
        }

        await quotation.save();
        await quotation.populate("lead", "customerName companyName contactNumber email status");
        await quotation.populate("createdBy", "name email");
        await quotation.populate("approvedBy", "name");

        res.status(200).json({ message: "Quotation updated successfully", quotation });
    } catch (error) {
        res.status(500).json({ message: "Error updating quotation", error: error.message });
    }
};

// Delete Quotation
exports.deleteQuotation = async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) return res.status(404).json({ message: "Quotation not found" });

        const isAdminOrManager = req.user.role?.name === "Admin" || req.user.role?.name === "Sales Manager";
        if (!isAdminOrManager && quotation.createdBy?.toString() !== req.user.id) {
            return res.status(403).json({ message: "Access Denied: You cannot delete this quotation" });
        }

        await Quotation.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Quotation deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting quotation", error: error.message });
    }
};

// Get Public Quotation (No auth required, for customer web view & download)
exports.getPublicQuotation = async (req, res) => {
    try {
        const identifier = req.params.quotationNumber;
        let query = { quotationNumber: identifier };

        let quotation = await Quotation.findOne(query)
            .populate("lead", "customerName companyName contactNumber email address location status")
            .populate("createdBy", "name email")
            .populate("approvedBy", "name")
            .populate("items.itemId", "name productCode serviceCode description");

        // If not found by quotationNumber, fallback to _id if valid ObjectId
        if (!quotation && mongoose.Types.ObjectId.isValid(identifier)) {
            quotation = await Quotation.findById(identifier)
                .populate("lead", "customerName companyName contactNumber email address location status")
                .populate("createdBy", "name email")
                .populate("approvedBy", "name")
                .populate("items.itemId", "name productCode serviceCode description");
        }

        if (!quotation) {
            return res.status(404).json({ message: "Quotation not found or link has expired." });
        }

        const settings = await Settings.findOne();

        res.status(200).json({
            quotation,
            settings: settings || {}
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching quotation", error: error.message });
    }
};
