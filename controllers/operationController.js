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
        const { leadId, quotationId, customerName, remarks } = req.body;
        
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
            remarks,
            currentStep: 1
        });

        // Fetch all templates to generate tasks
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
        const projects = await Project.find()
            .populate("lead", "customerName email contactNumber")
            .populate("operationHead", "name");
        res.status(200).json(projects);
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

// ================= TASKS (Phase 4) =================
exports.assignTask = async (req, res) => {
    try {
        const { assignedTo } = req.body;
        const task = await Task.findById(req.params.id).populate("project");
        if (!task) return res.status(404).json({ message: "Task not found" });

        if (task.project && task.stepNumber !== task.project.currentStep) {
            return res.status(400).json({ message: `Cannot assign Step ${task.stepNumber} task. Project is currently at Step ${task.project.currentStep}.` });
        }

        const tatHours = parseFloat(task.tatHours) || 24;
        
        // Calculate due date correctly handling decimal hours
        const dueDate = new Date(Date.now() + (tatHours * 60 * 60 * 1000));

        task.assignedTo = assignedTo;
        task.assignedBy = req.user.id;
        task.assignedAt = new Date();
        task.dueDate = dueDate;
        task.status = "In Progress";
        
        await task.save();
        res.status(200).json({ message: "Task assigned successfully with TAT deadline", task });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getTasks = async (req, res) => {
    try {
        let filter = {};
        if (req.user.role?.name !== "Admin" && req.user.role?.name !== "Operation Head") {
            filter.assignedTo = req.user.id;
        }
        const tasks = await Task.find(filter)
            .populate("project", "customerName status currentStep")
            .populate("department", "name")
            .populate("assignedTo", "name")
            .populate("assignedBy", "name")
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

        if (req.user.role !== "Admin" && req.user.role !== "Operation Head" && task.assignedTo.toString() !== req.user.id) {
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
