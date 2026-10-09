const Lead = require("../models/Lead");
const Quotation = require("../models/Quotation");
const User = require("../models/User");
const Role = require("../models/Role");
const Project = require("../models/Project");
const Task = require("../models/Task");
const TaskTemplate = require("../models/TaskTemplate");
const Payment = require("../models/Payment");

// Create a new Lead
exports.createLead = async (req, res) => {
    try {
        const { customerName, contactNumber, email, companyName, status, customerPassword } = req.body;
        
        let newDocuments = [];
        if (req.files && req.files.length > 0) {
            const { documentTypes } = req.body;
            let typesArray = [];
            if (Array.isArray(documentTypes)) {
                typesArray = documentTypes;
            } else if (documentTypes) {
                typesArray = [documentTypes];
            }

            req.files.forEach((file, index) => {
                const docType = typesArray[index] || 'Other';
                newDocuments.push({
                    documentType: docType,
                    fileName: file.originalname,
                    fileUrl: `/uploads/${file.filename}`,
                    uploadedBy: req.user.id,
                    status: "Pending"
                });
            });
        }

        const lead = await Lead.create({
            customerName,
            contactNumber,
            email,
            companyName,
            customerPassword,
            status: status || 'Pending',
            documents: newDocuments,
            createdBy: req.user.id
        });

        res.status(201).json({ message: "Lead created successfully", lead });
    } catch (error) {
        res.status(500).json({ message: "Error creating lead", error: error.message });
    }
};

// Get Closed Won (Converted) Leads
exports.getClosedWonLeads = async (req, res) => {
    try {
        let filter = {
            $or: [
                { isConverted: true },
                { status: "Closed-Won" }
            ]
        };
        const userRole = req.user.role?.name;

        // Hierarchy Filtering for Closed Won Leads
        if (userRole === "Admin" || userRole === "Operation Head") {
            // Admin and Ops Head see all Closed Won leads
        } else if (userRole === "Sales Manager") {
            // Manager sees their own + children's converted leads
            const children = await User.find({ reportingManager: req.user.id }).select("_id");
            const allowedIds = children.map(u => u._id.toString());
            allowedIds.push(req.user.id.toString());
            filter.createdBy = { $in: allowedIds };
        } else {
            // Staff / Executive sees only their own converted leads
            filter.createdBy = req.user.id;
        }

        const leads = await Lead.find(filter)
            .sort({ createdAt: -1 })
            .populate("createdBy", "name email")
            .populate("remarks.addedBy", "name")
            .populate("quotation");

        res.status(200).json({ leads, total: leads.length });
    } catch (error) {
        res.status(500).json({ message: "Error fetching closed won leads", error: error.message });
    }
};

// Bulk Create Leads (For Excel Import) removed

// Get Leads (RBAC: Admin/Manager sees all, Exec sees only their own)
exports.getLeads = async (req, res) => {
    try {
        let filter = {};
        const userRole = req.user.role?.name;

        const { page = 1, limit = 10, status, search } = req.query;
        
        if (status && status !== 'All') {
            filter.status = status;
        }

        // Hierarchy Filtering (Same as Quotations)
        if (userRole === "Admin" || userRole === "Operation Head") {
            // Can see all leads
        } else if (userRole === "Sales Manager") {
            // Manager sees their own + children's leads
            const children = await User.find({ reportingManager: req.user.id }).select("_id");
            const allowedIds = children.map(u => u._id.toString());
            allowedIds.push(req.user.id.toString());
            filter.createdBy = { $in: allowedIds };
        } else {
            // Sales Executive sees only their own
            filter.createdBy = req.user.id;
        }

        if (search) {
            filter.$or = [
                { customerName: { $regex: search, $options: "i" } },
                { companyName: { $regex: search, $options: "i" } },
                { contactNumber: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const totalLeads = await Lead.countDocuments(filter);

        const leads = await Lead.find(filter)
            .sort({ createdAt: -1 }) // Newest first
            .skip(skip)
            .limit(parseInt(limit))
            .populate("remarks.addedBy", "name");

        // Attach latest quotation for each lead
        const leadIds = leads.map(l => l._id);
        const quotations = await Quotation.find({ lead: { $in: leadIds } })
            .select("quotationNumber totalAmount status createdAt lead")
            .sort({ createdAt: -1 });

        const quoteMap = {};
        quotations.forEach(q => {
            const lid = q.lead.toString();
            if (!quoteMap[lid]) {
                quoteMap[lid] = q;
            }
        });

        const enhancedLeads = leads.map(lead => {
            const leadObj = lead.toObject();
            leadObj.quotation = quoteMap[lead._id.toString()] || null;
            return leadObj;
        });
            
        res.status(200).json({
            leads: enhancedLeads,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalLeads / limit),
            totalLeads
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching leads", error: error.message });
    }
};

// Update Lead (Status change or adding Follow-up remark)
exports.updateLead = async (req, res) => {
    try {
        const { customerName, contactNumber, email, companyName, source, status, remarkText, nextFollowUpDate, customerPassword } = req.body;
        const lead = await Lead.findById(req.params.id);

        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        if (customerName) lead.customerName = customerName;
        if (contactNumber) lead.contactNumber = contactNumber;
        if (email !== undefined) lead.email = email;
        if (companyName !== undefined) lead.companyName = companyName;
        if (source) lead.source = source;
        if (customerPassword !== undefined) lead.customerPassword = customerPassword;
        if (status) {
            if (lead.status === "Closed-Won" && status !== "Closed-Won") {
                return res.status(400).json({ message: "Lead status cannot be changed once it is Closed-Won" });
            }
            
            // If status is changing to Closed-Won, auto-create customer account
            if (lead.status !== "Closed-Won" && status === "Closed-Won") {
                if (!lead.email || !lead.customerPassword) {
                    return res.status(400).json({ message: "Email and Customer Password are required to mark as Closed-Won and create account" });
                }

                // Check if customer role exists
                let customerRole = await Role.findOne({ name: "Customer" });
                if (!customerRole) {
                    customerRole = await Role.create({
                        name: "Customer",
                        permissions: ["view_own_data"]
                    });
                }

                // Check if user already exists
                const existingUser = await User.findOne({ email: lead.email });
                if (!existingUser) {
                    await User.create({
                        name: lead.customerName,
                        email: lead.email,
                        password: lead.customerPassword,
                        role: customerRole._id,
                        isActive: true
                    });
                }

                // --- AUTO-CREATE PROJECT ---
                // Mark lead as converted
                lead.isConverted = true;

                const existingProject = await Project.findOne({ lead: lead._id });
                if (!existingProject) {
                    const project = await Project.create({
                        lead: lead._id,
                        customerName: lead.customerName,
                        operationHead: req.user.id, // Assign current user (admin/sales) as default, can be changed later
                        remarks: "Auto-created from Closed-Won lead",
                        currentStep: 1
                    });

                    // Auto-generate Tasks
                    const templates = await TaskTemplate.find().sort({ stepNumber: 1 });
                    const tasksToCreate = templates.map(template => ({
                        project: project._id,
                        department: template.department,
                        stepNumber: template.stepNumber,
                        taskName: template.taskName,
                        description: template.description,
                        tatHours: template.tatHours,
                        opsHeadReminderHours: template.opsHeadReminderHours || 24,
                        requiredDocuments: template.requiredDocuments.map(doc => ({ documentName: doc, isUploaded: false })),
                        status: "Pending"
                    }));

                    if (tasksToCreate.length > 0) {
                        await Task.insertMany(tasksToCreate);
                    }

                    // --- AUTO-CREATE PAYMENT ---
                    const existingPayment = await Payment.findOne({ lead: lead._id });
                    if (!existingPayment) {
                        // Find latest approved quotation
                        const latestQuotation = await Quotation.findOne({ lead: lead._id, status: 'Approved' }).sort({ createdAt: -1 });
                        const totalAmount = latestQuotation ? latestQuotation.totalAmount : 0;
                        
                        if (totalAmount > 0) {
                            await Payment.create({
                                lead: lead._id,
                                project: project._id,
                                totalAmount,
                                balanceAmount: totalAmount
                            });
                        }
                    }
                }
            }

            lead.status = status;
        }
        if (nextFollowUpDate) lead.nextFollowUpDate = nextFollowUpDate;

        if (remarkText) {
            lead.remarks.push({
                text: remarkText,
                addedBy: req.user.id
            });
        }

        await lead.save();
        res.status(200).json({ message: "Lead updated successfully", lead });
    } catch (error) {
        res.status(500).json({ message: "Error updating lead", error: error.message });
    }
};

// Get Single Lead by ID
exports.getLeadById = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .populate("remarks.addedBy", "name");
        
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        const quotation = await Quotation.findOne({ lead: lead._id })
            .select("quotationNumber totalAmount status createdAt")
            .sort({ createdAt: -1 });

        const leadObj = lead.toObject();
        leadObj.quotation = quotation || null;

        res.status(200).json(leadObj);
    } catch (error) { res.status(500).json({ message: "Error fetching lead", error: error.message }); }
};

// Re-assign Lead (Admin / Manager only)
exports.assignLead = async (req, res) => {
    try {
        const { assignedTo } = req.body;
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: "Lead not found" });
        
        lead.assignedTo = assignedTo;
        lead.assignedBy = req.user.id;
        await lead.save();

        await lead.populate("assignedTo", "name email");
        await lead.populate("assignedBy", "name email");

        res.status(200).json({ message: "Lead reassigned successfully", lead });
    } catch (error) { res.status(500).json({ message: "Error assigning lead", error: error.message }); }
};

// Bulk Assign Leads (Admin / Manager only)
exports.bulkAssignLeads = async (req, res) => {
    try {
        const { leadIds, assignedTo } = req.body;

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ message: "Please provide an array of lead IDs" });
        }

        if (!assignedTo) {
            return res.status(400).json({ message: "Please provide assignedTo user ID" });
        }

        const result = await Lead.updateMany(
            { _id: { $in: leadIds } },
            {
                $set: {
                    assignedTo: assignedTo,
                    assignedBy: req.user.id
                }
            }
        );

        res.status(200).json({
            message: `${result.modifiedCount} leads successfully assigned!`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        res.status(500).json({ message: "Error bulk assigning leads", error: error.message });
    }
};

// Convert Lead to Customer (Onboarding to Phase 4 Operations)
exports.convertLead = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        if (lead.status !== "Closed-Won") {
            return res.status(400).json({ message: "Lead must be marked as 'Closed-Won' before converting to Customer" });
        }

        lead.isConverted = true;
        await lead.save();
        
        res.status(200).json({ message: "Lead successfully converted to Customer! Ready for Operations.", lead });
    } catch (error) { res.status(500).json({ message: "Error converting lead", error: error.message }); }
};



// Upload a new document for an existing Lead
exports.uploadLeadDocument = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        if (!req.file && !req.files) {
            return res.status(400).json({ message: "Please select a file to upload" });
        }

        const file = req.file || (req.files && req.files[0]);
        let docType = req.body.documentTypes || 'Other';
        if (Array.isArray(docType)) docType = docType[0];

        const replaceDocId = req.body.replaceDocId;
        if (replaceDocId) {
            const existingDoc = lead.documents.id(replaceDocId);
            if (existingDoc) {
                existingDoc.documentType = docType;
                existingDoc.fileName = file.originalname;
                existingDoc.fileUrl = `/uploads/${file.filename}`;
                existingDoc.uploadedBy = req.user.id;
                existingDoc.uploadedAt = Date.now();
                existingDoc.status = "Pending";
                existingDoc.remarks = ""; // clear old remarks
            } else {
                return res.status(404).json({ message: "Document to replace not found" });
            }
        } else {
            const newDoc = {
                documentType: docType,
                fileName: file.originalname,
                fileUrl: `/uploads/${file.filename}`,
                uploadedBy: req.user.id,
                status: "Pending"
            };
            lead.documents.push(newDoc);
        }
        
        // Change lead status back to Pending ONLY if there are no other Rejected documents
        const hasRejectedDocs = lead.documents.some(doc => doc.status === 'Rejected');
        if (lead.status === 'Rejected' && !hasRejectedDocs) {
            lead.status = 'Pending';
        }

        await lead.save();
        res.status(201).json({ message: "Document uploaded successfully", documents: lead.documents });
    } catch (error) {
        res.status(500).json({ message: "Error uploading document", error: error.message });
    }
};

// Get Documents for a Lead
exports.getLeadDocuments = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .select("documents")
            .populate("documents.uploadedBy", "name email");

        if (!lead) return res.status(404).json({ message: "Lead not found" });

        res.status(200).json({ documents: lead.documents });
    } catch (error) {
        res.status(500).json({ message: "Error fetching documents", error: error.message });
    }
};

// Verify/Reject a Specific Document
exports.verifyDocument = async (req, res) => {
    try {
        const { documentId, status, remarks } = req.body; // status: "Verified" or "Rejected"
        const lead = await Lead.findById(req.params.id);

        if (!lead) return res.status(404).json({ message: "Lead not found" });

        const document = lead.documents.id(documentId);
        if (!document) return res.status(404).json({ message: "Document not found" });

        if (status) {
            document.status = status;
            document.verifiedBy = req.user.id;
            document.verifiedAt = Date.now();
            
            // If document is rejected, also set the Lead status to Rejected
            if (status === 'Rejected') {
                lead.status = 'Rejected';
            } else if (status === 'Verified') {
                // Check if all documents are Verified
                const allVerified = lead.documents.every(doc => doc.status === 'Verified');
                if (allVerified) {
                    lead.status = 'Approved';
                }
            }
        }
        if (remarks) document.remarks = remarks;

        await lead.save();
        res.status(200).json({ message: `Document marked as ${status}`, document });
    } catch (error) {
        res.status(500).json({ message: "Error verifying document", error: error.message });
    }
};

// Delete Lead
exports.deleteLead = async (req, res) => {
    try {
        const lead = await Lead.findByIdAndDelete(req.params.id);
        if (!lead) return res.status(404).json({ message: "Lead not found" });
        res.status(200).json({ message: "Lead deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting lead", error: error.message });
    }
};
