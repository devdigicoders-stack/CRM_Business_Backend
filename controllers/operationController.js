const Project = require("../models/Project");
const Task = require("../models/Task");
const Lead = require("../models/Lead");
const Settings = require("../models/Settings");
const TaskTemplate = require("../models/TaskTemplate");
const Payment = require("../models/Payment");
const Quotation = require("../models/Quotation");

// ================= PROJECTS (Phase 4) =================
exports.createProject = async (req, res) => {
    try {
        const { leadId, quotationId, customerName, remarks, selectedTemplateIds } = req.body;
        
        // Ensure lead exists and is either converted or Closed-Won
        const lead = await Lead.findById(leadId);
        if (!lead || (lead.status !== "Closed-Won" && !lead.isConverted)) {
            return res.status(400).json({ message: "Lead must be 'Closed-Won' or 'Converted' before creating a project" });
        }

        // Auto-convert lead if it's just Closed-Won
        if (!lead.isConverted) {
            lead.isConverted = true;
            await lead.save();
        }

        // Check if project already exists for this lead
        const existingProject = await Project.findOne({ lead: leadId });
        if (existingProject) {
            return res.status(400).json({ message: "Project is already created for this lead" });
        }

        const project = await Project.create({
            lead: leadId,
            customerName,
            quotation: quotationId ? quotationId : undefined,
            operationHead: req.user.id,
            assignedTo: lead.assignedTo || lead.createdBy || req.user.id,
            remarks,
            currentStep: 1
        });

        // Fetch selected or all templates to generate tasks
        let templateQuery = {};
        if (Array.isArray(selectedTemplateIds) && selectedTemplateIds.length > 0) {
            templateQuery._id = { $in: selectedTemplateIds };
        }
        const templates = await TaskTemplate.find(templateQuery).sort({ stepNumber: 1 });
        const tasksToCreate = templates.map((template, idx) => ({
            project: project._id,
            department: template.department,
            stepNumber: idx + 1,
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

        // ===== AUTO-CREATE PAYMENT ACCOUNT =====
        // Check if payment account already exists for this lead
        const existingPayment = await Payment.findOne({ lead: leadId });
        if (!existingPayment) {
            let totalAmount = 0;

            // Try to get amount from linked quotation
            if (quotationId) {
                const quotation = await Quotation.findById(quotationId);
                if (quotation && quotation.totalAmount) {
                    totalAmount = quotation.totalAmount;
                }
            }

            // If no quotation, try to get from lead's latest approved quotation
            if (totalAmount === 0) {
                const latestQuotation = await Quotation.findOne({ lead: leadId, status: 'Approved' }).sort({ createdAt: -1 });
                if (latestQuotation) {
                    totalAmount = latestQuotation.totalAmount;
                }
            }

            // Create payment account only if we have an amount
            if (totalAmount > 0) {
                await Payment.create({
                    lead: leadId,
                    project: project._id,
                    totalAmount,
                    balanceAmount: totalAmount
                });
                console.log(`[Payment] Auto-created payment account for project ${project._id} | Amount: ₹${totalAmount}`);
            } else {
                console.log(`[Payment] No quotation amount found for lead ${leadId}. Payment account not created.`);
            }
        }

        res.status(201).json({ message: "Project created successfully. Operations started!", project });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getProjects = async (req, res) => {
    try {
        let filter = {};
        const userRole = req.user.role?.name;
        const userId = req.user._id || req.user.id;
        const User = require("../models/User");

        if (userRole === "Customer") {
            // Find leads associated with this customer
            const userEmail = req.user.email;
            const leads = await Lead.find({ email: userEmail }).select("_id");
            const leadIds = leads.map(l => l._id);
            filter = { lead: { $in: leadIds } };
        } else if (userRole === "Admin" || userRole === "Operation Head") {
            // Admin and Ops Head see all projects
        } else {
            // Staff / Sales Manager / Sales Executive / Employee:
            const children = await User.find({ reportingManager: userId }).select("_id");
            const relevantUserIds = [userId, ...children.map(u => u._id)];

            // Find leads belonging to relevant users
            const userLeads = await Lead.find({
                $or: [
                    { createdBy: { $in: relevantUserIds } },
                    { assignedTo: { $in: relevantUserIds } }
                ]
            }).select("_id");
            const userLeadIds = userLeads.map(l => l._id);

            // Find projects where user/subordinates have assigned tasks
            const userTasks = await Task.find({ assignedTo: { $in: relevantUserIds } }).select("project");
            const taskProjectIds = userTasks.map(t => t.project).filter(Boolean);

            filter = {
                $or: [
                    { lead: { $in: userLeadIds } },
                    { operationHead: { $in: relevantUserIds } },
                    { assignedTo: { $in: relevantUserIds } },
                    { _id: { $in: taskProjectIds } }
                ]
            };
        }

        const projects = await Project.find(filter)
            .populate({
                path: "lead",
                select: "customerName email contactNumber createdBy assignedTo",
                populate: [
                    { path: "createdBy", select: "name email" },
                    { path: "assignedTo", select: "name email" }
                ]
            })
            .populate("operationHead", "name email")
            .populate("assignedTo", "name email")
            .populate("quotation")
            .sort({ createdAt: -1 })
            .lean(); // Lean for modifying the object

        const Payment = require("../models/Payment");

        // Attach payment info and quotation data to each project
        const projectsWithPayment = await Promise.all(projects.map(async (project) => {
            const payment = await Payment.findOne({ project: project._id });
            let quotation = project.quotation;
            if (!quotation && project.lead) {
                const leadId = project.lead._id || project.lead;
                quotation = await Quotation.findOne({ lead: leadId, status: "Approved" }).sort({ createdAt: -1 }).lean();
                if (!quotation) {
                    quotation = await Quotation.findOne({ lead: leadId }).sort({ createdAt: -1 }).lean();
                }
            }
            return {
                ...project,
                quotationData: quotation,
                paymentData: payment ? {
                    totalAmount: payment.totalAmount,
                    paidAmount: payment.paidAmount,
                    balanceAmount: payment.balanceAmount,
                    status: payment.status
                } : null
            };
        }));

        res.status(200).json(projectsWithPayment);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.forwardProjectWorkflow = async (req, res) => {
    try {
        const { toStage, remarks } = req.body;
        const project = await Project.findById(req.params.id);
        
        if (!project) return res.status(404).json({ message: "Project not found" });

        const validStages = ["Pending Registration", "Bank Coordination", "Installation", "Completed"];
        if (!validStages.includes(toStage)) {
            return res.status(400).json({ message: "Invalid workflow stage" });
        }

        const fromStage = project.workflowStage;
        
        project.workflowStage = toStage;
        project.workflowHistory.push({
            fromStage,
            toStage,
            movedBy: req.user.id,
            remarks
        });

        // Automatically update main status based on stage
        if (toStage === "Completed") {
            project.status = "Completed";
            project.endDate = new Date();
        } else {
            project.status = "In Progress";
        }

        await project.save();
        res.status(200).json({ message: `Project forwarded to ${toStage}`, project });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getProjectDocuments = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: "Project not found" });

        const lead = await Lead.findById(project.lead);
        const CustomerDocument = require("../models/CustomerDocument");
        const extraDocs = await CustomerDocument.find({ lead: project.lead });

        let allDocs = [];
        if (lead && lead.documents) {
            allDocs = lead.documents.map(d => ({
                documentName: d.documentType,
                fileUrl: d.fileUrl,
                source: 'Lead'
            }));
        }

        extraDocs.forEach(d => {
            allDocs.push({
                documentName: d.documentName,
                fileUrl: d.fileUrl,
                source: 'CustomerDocument'
            });
        });

        res.status(200).json(allDocs);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ================= TASKS (Phase 4) =================
exports.assignMultipleTasks = async (req, res) => {
    try {
        const { assignments, taskIds, assignedTo, referenceDocuments } = req.body;
        let assignmentList = [];

        // Mode 1: Array of individual assignments: [{ taskId, assignedTo, referenceDocuments }]
        if (Array.isArray(assignments) && assignments.length > 0) {
            assignmentList = assignments.filter(a => a && a.taskId && a.assignedTo);
        } 
        // Mode 2: Bulk assignment of taskIds to single assignedTo
        else if (Array.isArray(taskIds) && taskIds.length > 0 && assignedTo) {
            assignmentList = taskIds.map(taskId => ({
                taskId,
                assignedTo,
                referenceDocuments: referenceDocuments || []
            }));
        }

        if (assignmentList.length === 0) {
            return res.status(400).json({ message: "No tasks to assign. Please select an employee for at least one task." });
        }

        const updatedTasks = [];
        const affectedProjectIds = new Set();

        for (const item of assignmentList) {
            const task = await Task.findById(item.taskId).populate("project");
            if (!task) continue;

            const tatHours = parseFloat(task.tatHours) || 24;
            const dueDate = new Date(Date.now() + (tatHours * 60 * 60 * 1000));

            task.assignedTo = item.assignedTo;
            task.assignedBy = req.user.id;
            task.assignedAt = new Date();
            task.dueDate = dueDate;
            task.status = "In Progress";

            if (item.referenceDocuments && Array.isArray(item.referenceDocuments) && item.referenceDocuments.length > 0) {
                task.referenceDocuments = item.referenceDocuments;
            }

            await task.save();
            updatedTasks.push(task);

            if (task.project && task.project._id) {
                affectedProjectIds.add(task.project._id.toString());
            }
        }

        // If any affected project was Pending, mark it In Progress
        for (const projId of affectedProjectIds) {
            const project = await Project.findById(projId);
            if (project && project.status === "Pending") {
                project.status = "In Progress";
                await project.save();
            }
        }

        return res.status(200).json({
            message: `Successfully assigned ${updatedTasks.length} task(s)!`,
            count: updatedTasks.length,
            tasks: updatedTasks
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.assignTask = async (req, res) => {
    try {
        const { assignedTo } = req.body;
        const task = await Task.findById(req.params.id).populate("project");
        if (!task) return res.status(404).json({ message: "Task not found" });

        const tatHours = parseFloat(task.tatHours) || 24;
        
        // Calculate due date correctly handling decimal hours
        const dueDate = new Date(Date.now() + (tatHours * 60 * 60 * 1000));

        task.assignedTo = assignedTo;
        task.assignedBy = req.user.id;
        task.assignedAt = new Date();
        task.dueDate = dueDate;
        task.status = "In Progress";
        
        // Add reference documents if provided
        if (req.body.referenceDocuments && Array.isArray(req.body.referenceDocuments)) {
            task.referenceDocuments = req.body.referenceDocuments;
        }
        
        await task.save();

        if (task.project) {
            const project = await Project.findById(task.project._id);
            if (project && project.status === "Pending") {
                project.status = "In Progress";
                await project.save();
            }
        }

        res.status(200).json({ message: "Task assigned successfully with TAT deadline", task });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getTasks = async (req, res) => {
    try {
        let filter = {};
        const userRole = req.user.role?.name;
        const userId = req.user._id || req.user.id;
        const User = require("../models/User");

        if (userRole === "Customer") {
            const userEmail = req.user.email;
            const leads = await Lead.find({ email: userEmail }).select("_id");
            const leadIds = leads.map(l => l._id);
            const projects = await Project.find({ lead: { $in: leadIds } }).select("_id");
            const projectIds = projects.map(p => p._id);
            filter.project = { $in: projectIds };
        } else if (userRole === "Admin" || userRole === "Operation Head") {
            // Admin and Ops Head see all tasks
            if (req.query.projectId || req.query.project) {
                filter.project = req.query.projectId || req.query.project;
            }
        } else {
            // For other roles (Sales Manager, Sales Executive, Employee, Technicians, etc.):
            // 1. Direct tasks assigned to this user / subordinates
            // 2. Tasks for projects where this user is assignedTo or operationHead
            // 3. Tasks for projects linked to leads assigned to or created by this user
            const children = await User.find({ reportingManager: userId }).select("_id");
            const relevantUserIds = [userId, ...children.map(u => u._id)];

            // Find leads assigned to or created by relevant users
            const leads = await Lead.find({
                $or: [
                    { createdBy: { $in: relevantUserIds } },
                    { assignedTo: { $in: relevantUserIds } }
                ]
            }).select("_id");
            const leadIds = leads.map(l => l._id);

            // Find projects where user/subordinates have assigned tasks
            const userTasks = await Task.find({ assignedTo: { $in: relevantUserIds } }).select("project");
            const taskProjectIds = userTasks.map(t => t.project).filter(Boolean);

            // Find projects linked to those leads, OR projects directly assigned to relevant users, OR projects where user has tasks
            const projects = await Project.find({
                $or: [
                    { lead: { $in: leadIds } },
                    { operationHead: { $in: relevantUserIds } },
                    { assignedTo: { $in: relevantUserIds } },
                    { _id: { $in: taskProjectIds } }
                ]
            }).select("_id");
            const projectIds = projects.map(p => p._id);

            const orConditions = [
                { assignedTo: { $in: relevantUserIds } }
            ];

            if (projectIds.length > 0) {
                orConditions.push({ project: { $in: projectIds } });
            }

            if (req.query.projectId || req.query.project) {
                const requestedProj = req.query.projectId || req.query.project;
                filter = {
                    $and: [
                        { project: requestedProj },
                        { $or: orConditions }
                    ]
                };
            } else {
                filter.$or = orConditions;
            }
        }

        // ================= STATUS FILTERING =================
        // Assigned employees should only see OPEN tasks. Completed & Approved tasks must be hidden.
        const isProjectSpecific = Boolean(req.query.projectId || req.query.project);
        const isAdminOrOps = userRole === "Admin" || userRole === "Operation Head";

        let statusCondition = null;
        if (req.query.status) {
            const st = req.query.status.toLowerCase();
            if (st === 'open') {
                statusCondition = { status: { $nin: ["Completed", "Approved"] } };
            } else if (st !== 'all') {
                statusCondition = { status: req.query.status };
            }
        } else if (!isProjectSpecific && !isAdminOrOps && req.query.includeCompleted !== 'true') {
            // Default for assigned staff/employees: ONLY OPEN TASKS (hide Completed and Approved tasks)
            statusCondition = { status: { $nin: ["Completed", "Approved"] } };
        }

        if (statusCondition) {
            if (filter.$or) {
                filter = {
                    $and: [
                        { $or: filter.$or },
                        statusCondition
                    ]
                };
            } else if (filter.$and) {
                filter.$and.push(statusCondition);
            } else {
                Object.assign(filter, statusCondition);
            }
        }

        const tasks = await Task.find(filter)
            .populate("project", "customerName status currentStep workflowStage")
            .populate("department", "name")
            .populate("assignedTo", "name email")
            .populate("assignedBy", "name email")
            .populate({
                path: "remarks.addedBy",
                select: "name role",
                populate: { path: "role", select: "name" }
            })
            .sort({ "project": 1, "stepNumber": 1 });

        res.status(200).json(tasks);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.submitTask = async (req, res) => {
    try {
        const { remarkText } = req.body; 
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ message: "Task not found" });

        const isAdminOrOps = req.user.role?.name === "Admin" || req.user.role?.name === "Operation Head";
        if (!isAdminOrOps && task.assignedTo?.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: "You can only submit your own tasks." });
        }

        // Handle uploaded files via multer
        if (req.files && req.files.length > 0) {
            task.requiredDocuments.forEach(doc => {
                const file = req.files.find(f => f.fieldname === doc.documentName);
                if (file) {
                    doc.isUploaded = true;
                    doc.fileUrl = "/uploads/" + file.filename;
                }
            });
        } else if (req.body.uploadedDocuments) {
            try {
                const parsed = typeof req.body.uploadedDocuments === 'string' ? JSON.parse(req.body.uploadedDocuments) : req.body.uploadedDocuments;
                if (Array.isArray(parsed)) {
                    task.requiredDocuments.forEach(doc => {
                        const found = parsed.find(u => u.documentName === doc.documentName);
                        if (found) {
                            doc.isUploaded = true;
                            doc.fileUrl = found.fileUrl;
                        }
                    });
                }
            } catch(e) {}
        }

        const allUploaded = task.requiredDocuments.every(doc => doc.isUploaded);
        if (task.requiredDocuments.length > 0 && !allUploaded) {
            return res.status(400).json({ message: "All required documents must be uploaded before submitting." });
        }

        task.status = "Submitted";
        task.submittedAt = new Date();
        
        if (remarkText) {
            task.remarks.push({ text: remarkText, addedBy: req.user.id });
        }

        await task.save();
        res.status(200).json({ message: "Task submitted for approval", task });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.approveTask = async (req, res) => {
    try {
        const { status, remarkText } = req.body; // "Approved" or "Rejected"
        const task = await Task.findById(req.params.id).populate("project");
        if (!task) return res.status(404).json({ message: "Task not found" });

        if (status === "Rejected") {
            task.status = "Rejected"; 
            task.approvedAt = new Date(); // To record when it was rejected
            
            // Reset the TAT timer so the employee gets time to fix it
            const tatHours = parseFloat(task.tatHours) || 24;
            task.dueDate = new Date(Date.now() + (tatHours * 60 * 60 * 1000));
            task.isTATBreached = false; // Reset breach flag so they can get a new warning mail
        } else {
            task.status = "Completed";
            task.approvedAt = new Date();
            task.completedAt = new Date();

            if (task.project) {
                const project = await Project.findById(task.project._id);
                project.currentStep += 1;
                
                // Check if all tasks for this project are completed
                const totalTasksCount = await Task.countDocuments({ project: project._id });
                
                if (project.currentStep > totalTasksCount) {
                    project.status = "Completed";
                    project.workflowStage = "Completed";
                    project.endDate = new Date();
                } else if (project.status === "Pending") {
                    project.status = "In Progress";
                }

                await project.save();
            }
        }

        if (remarkText) {
            task.remarks.push({ text: remarkText, addedBy: req.user.id });
        }

        await task.save();
        res.status(200).json({ message: `Task ${status} successfully`, task });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ================= TAT REMARKS =================
exports.addTATRemark = async (req, res) => {
    try {
        const { text } = req.body;
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ message: "Task not found" });

        // Ensure task is actually breached before allowing TAT remark
        const isBreached = task.isTATBreached || (new Date() > task.dueDate);
        
        if (!isBreached) {
            return res.status(400).json({ message: "Task is not overdue. TAT is not breached yet." });
        }

        task.isTATBreached = true; // Mark as breached if not already
        if(task.status !== "Completed") {
             task.status = "Overdue";
        }

        task.tatRemarks.push({
            text,
            addedBy: req.user.id
        });

        await task.save();
        res.status(200).json({ message: "TAT delay remark added successfully", task });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ================= HARDWARE / EQUIPMENT =================
exports.addInstalledEquipment = async (req, res) => {
    try {
        const { equipments } = req.body;
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: "Project not found" });

        project.installedEquipments = equipments; // array of { itemName, serialNumber, quantity }
        await project.save();

        res.status(200).json({ message: "Installed equipments updated successfully", project });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ================= DELETE PROJECT (Super Admin Only) =================
exports.deleteProject = async (req, res) => {
    try {
        // Enforce Super Admin check
        const isSuperAdmin = req.user.role?.name === "Admin" || req.user.role?.name === "Super Admin";
        if (!isSuperAdmin) {
            return res.status(403).json({ message: "Access Denied: Only Super Admin can delete projects" });
        }

        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        // Prevent deletion of completed projects
        if (project.status === "Completed" || project.workflowStage === "Completed") {
            return res.status(400).json({ message: "Action Not Allowed: Completed projects cannot be deleted." });
        }

        // Delete all tasks associated with this project
        await Task.deleteMany({ project: project._id });

        // Delete all payment records linked to this project
        await Payment.deleteMany({ project: project._id });

        // If cascade delete requested (e.g. ?cascade=true or ?deleteLead=true)
        const shouldCascade = req.query.cascade === "true" || req.query.deleteLead === "true";

        if (project.lead) {
            if (shouldCascade) {
                const leadId = project.lead;
                const leadDoc = await Lead.findById(leadId);
                
                // Delete quotations linked to this lead
                await Quotation.deleteMany({ lead: leadId });

                // Delete customer documents
                try {
                    const CustomerDocument = require("../models/CustomerDocument");
                    await CustomerDocument.deleteMany({ lead: leadId });
                } catch (e) {}

                // Delete Customer user account
                if (leadDoc && leadDoc.email) {
                    try {
                        const Role = require("../models/Role");
                        const customerRole = await Role.findOne({ name: "Customer" });
                        if (customerRole) {
                            await User.deleteMany({ email: leadDoc.email, role: customerRole._id });
                        }
                    } catch (e) {}
                }

                // Delete the lead itself
                await Lead.findByIdAndDelete(leadId);
            } else {
                // Reset lead's isConverted flag if present
                await Lead.findByIdAndUpdate(project.lead, { isConverted: false });
            }
        }

        // Delete the project document
        await Project.findByIdAndDelete(req.params.id);

        res.status(200).json({ 
            message: shouldCascade 
                ? "Project, linked lead, quotations and customer account deleted successfully" 
                : "Project deleted successfully" 
        });
    } catch (err) {
        res.status(500).json({ message: "Error deleting project", error: err.message });
    }
};

// ================= ASSIGN PROJECT =================
exports.assignProject = async (req, res) => {
    try {
        const { assignedTo } = req.body;
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: "Project not found" });

        project.assignedTo = assignedTo;
        project.assignedBy = req.user.id;
        await project.save();

        const updatedProject = await Project.findById(project._id)
            .populate({
                path: "lead",
                select: "customerName email contactNumber createdBy assignedTo",
                populate: [
                    { path: "createdBy", select: "name email" },
                    { path: "assignedTo", select: "name email" }
                ]
            })
            .populate("operationHead", "name email")
            .populate("assignedTo", "name email");

        res.status(200).json({ message: "Project assigned successfully", project: updatedProject });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ================= ADD CUSTOM TASK TO PROJECT =================
exports.addCustomTask = async (req, res) => {
    try {
        const { taskName, department, description, tatHours, requiredDocuments } = req.body;
        if (!taskName || !department) {
            return res.status(400).json({ message: "Task name and department are required." });
        }

        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: "Project not found" });

        const highestTask = await Task.findOne({ project: project._id }).sort({ stepNumber: -1 });
        const nextStep = highestTask ? (highestTask.stepNumber || 0) + 1 : 1;

        let reqDocs = [];
        if (Array.isArray(requiredDocuments)) {
            reqDocs = requiredDocuments.map(d => typeof d === 'string' ? { documentName: d, isUploaded: false } : d);
        }

        const task = await Task.create({
            project: project._id,
            department,
            taskName,
            description: description || "",
            tatHours: tatHours || 24,
            opsHeadReminderHours: 24,
            stepNumber: nextStep,
            status: "Pending",
            requiredDocuments: reqDocs
        });

        const populatedTask = await Task.findById(task._id)
            .populate("project", "customerName status currentStep workflowStage")
            .populate("department", "name")
            .populate("assignedTo", "name email");

        res.status(201).json({ message: "Custom task added to project successfully", task: populatedTask });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ================= DELETE TASK FROM PROJECT =================
exports.deleteTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ message: "Task not found" });

        if (task.status === "Completed" || task.status === "Approved") {
            return res.status(400).json({ message: "Completed tasks cannot be deleted." });
        }

        const projectId = task.project;
        await task.deleteOne();

        // Re-number step numbers cleanly
        const remainingTasks = await Task.find({ project: projectId }).sort({ stepNumber: 1 });
        for (let i = 0; i < remainingTasks.length; i++) {
            if (remainingTasks[i].stepNumber !== i + 1) {
                remainingTasks[i].stepNumber = i + 1;
                await remainingTasks[i].save();
            }
        }

        res.status(200).json({ message: "Task removed from project successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ================= SELECT / SYNC TEMPLATE TASKS FOR PROJECT =================
exports.selectProjectTasks = async (req, res) => {
    try {
        const { selectedTemplateIds } = req.body;
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: "Project not found" });

        if (!Array.isArray(selectedTemplateIds) || selectedTemplateIds.length === 0) {
            return res.status(400).json({ message: "Please select at least one task template." });
        }

        // Fetch chosen templates
        const templates = await TaskTemplate.find({ _id: { $in: selectedTemplateIds } }).sort({ stepNumber: 1 });

        // Find existing tasks for this project
        const existingTasks = await Task.find({ project: project._id });

        // Delete any uncompleted task that is NOT in selected templates
        for (const t of existingTasks) {
            if (t.status !== "Completed" && t.status !== "Approved") {
                const isSelected = templates.some(tpl => tpl.taskName === t.taskName);
                if (!isSelected) {
                    await t.deleteOne();
                }
            }
        }

        // Add any selected template that doesn't exist yet
        const currentRemaining = await Task.find({ project: project._id });
        for (let i = 0; i < templates.length; i++) {
            const tpl = templates[i];
            const alreadyExists = currentRemaining.some(t => t.taskName === tpl.taskName);
            if (!alreadyExists) {
                await Task.create({
                    project: project._id,
                    department: tpl.department,
                    stepNumber: currentRemaining.length + i + 1,
                    taskName: tpl.taskName,
                    description: tpl.description,
                    tatHours: tpl.tatHours,
                    opsHeadReminderHours: tpl.opsHeadReminderHours || 24,
                    requiredDocuments: tpl.requiredDocuments.map(doc => ({ documentName: doc, isUploaded: false })),
                    status: "Pending"
                });
            }
        }

        // Re-number step numbers cleanly
        const updatedTasks = await Task.find({ project: project._id }).sort({ stepNumber: 1 });
        for (let i = 0; i < updatedTasks.length; i++) {
            updatedTasks[i].stepNumber = i + 1;
            await updatedTasks[i].save();
        }

        const finalTasks = await Task.find({ project: project._id })
            .populate("project", "customerName status currentStep workflowStage")
            .populate("department", "name")
            .populate("assignedTo", "name email");

        res.status(200).json({ message: "Project tasks updated successfully", tasks: finalTasks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

