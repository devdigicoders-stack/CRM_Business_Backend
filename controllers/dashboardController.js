const User = require("../models/User");
const Lead = require("../models/Lead");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Quotation = require("../models/Quotation");
const Payment = require("../models/Payment");

// Master Dashboard API - Returns role-based data
exports.getMasterDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const roleName = req.user.role?.name || '';
        const permissions = req.user.role?.permissions || [];

        const isAdmin = roleName === "Admin";
        const isSales = !isAdmin && (permissions.includes("view_leads") || permissions.includes("create_lead"));
        const isOpsHead = !isAdmin && !isSales && (permissions.includes("view_projects") || permissions.includes("manage_project_workflow"));
        const isEmployee = !isAdmin && !isSales && !isOpsHead;

        let data = { role: roleName };

        // ====== ADMIN - Full Overview ======
        if (isAdmin) {
            // Leads
            const totalLeads = await Lead.countDocuments();
            const pendingLeads = await Lead.countDocuments({ status: "New" });
            const closedWonLeads = await Lead.countDocuments({ status: "Closed-Won" });
            const inProgressLeads = await Lead.countDocuments({ status: { $in: ["Contacted", "Qualified", "Proposal Sent", "Negotiation"] } });

            // Quotations
            const totalQuotations = await Quotation.countDocuments();
            const pendingQuotations = await Quotation.countDocuments({ status: "Pending Approval" });
            const approvedQuotations = await Quotation.countDocuments({ status: "Approved" });

            // Projects
            const totalProjects = await Project.countDocuments();
            const activeProjects = await Project.countDocuments({ status: "In Progress" });
            const completedProjects = await Project.countDocuments({ status: "Completed" });
            const pendingProjects = await Project.countDocuments({ status: "Pending" });

            // Tasks
            const totalTasks = await Task.countDocuments();
            const pendingTasks = await Task.countDocuments({ status: "Pending" });
            const inProgressTasks = await Task.countDocuments({ status: "In Progress" });
            const submittedTasks = await Task.countDocuments({ status: "Submitted" });
            const completedTasks = await Task.countDocuments({ status: "Completed" });
            const overdueTasks = await Task.countDocuments({ dueDate: { $lt: new Date() }, status: { $in: ["Pending", "In Progress", "Rejected"] } });

            // Payments
            const allPayments = await Payment.find();
            const totalRevenue = allPayments.reduce((s, p) => s + (p.totalAmount || 0), 0);
            const totalCollected = allPayments.reduce((s, p) => s + (p.paidAmount || 0), 0);
            const totalPending = allPayments.reduce((s, p) => s + (p.balanceAmount || 0), 0);
            const pendingPaymentCount = allPayments.filter(p => p.status !== "Completed").length;

            // Users
            const totalUsers = await User.countDocuments();

            // Recent Leads
            const recentLeads = await Lead.find().sort({ createdAt: -1 }).limit(5).select("customerName status contactNumber createdAt");

            // Overdue Tasks Detail
            const overdueTasksList = await Task.find({ dueDate: { $lt: new Date() }, status: { $in: ["Pending", "In Progress", "Rejected"] } })
                .populate("assignedTo", "name")
                .populate("project", "customerName")
                .limit(5)
                .select("taskName status dueDate");

            data = {
                ...data,
                leads: { total: totalLeads, pending: pendingLeads, closedWon: closedWonLeads, inProgress: inProgressLeads },
                quotations: { total: totalQuotations, pending: pendingQuotations, approved: approvedQuotations },
                projects: { total: totalProjects, active: activeProjects, completed: completedProjects, pending: pendingProjects },
                tasks: { total: totalTasks, pending: pendingTasks, inProgress: inProgressTasks, submitted: submittedTasks, completed: completedTasks, overdue: overdueTasks },
                payments: { totalRevenue, totalCollected, totalPending, pendingCount: pendingPaymentCount },
                users: { total: totalUsers },
                recentLeads,
                overdueTasksList
            };
        }

        // ====== SALES - Lead & Quotation Overview ======
        else if (isSales) {
            // Find employees reporting to this user (e.g. Sales Manager's team)
            const reportingUsers = await User.find({ reportingManager: userId }).select('_id');
            const reportingUserIds = reportingUsers.map(u => u._id);
            
            // Array containing this user and all their reporting employees
            const userIdsToQuery = [userId, ...reportingUserIds];

            // My leads (and my team's leads)
            const myLeads = await Lead.countDocuments({ createdBy: { $in: userIdsToQuery } });
            const myPendingLeads = await Lead.countDocuments({ createdBy: { $in: userIdsToQuery }, status: "New" });
            const myClosedWon = await Lead.countDocuments({ createdBy: { $in: userIdsToQuery }, status: "Closed-Won" });
            const myInProgress = await Lead.countDocuments({ createdBy: { $in: userIdsToQuery }, status: { $in: ["Contacted", "Qualified", "Proposal Sent", "Negotiation"] } });
            const myLost = await Lead.countDocuments({ createdBy: { $in: userIdsToQuery }, status: "Closed-Lost" });

            // My quotations (and my team's quotations)
            const myQuotations = await Quotation.countDocuments({ createdBy: { $in: userIdsToQuery } });
            const myPendingQ = await Quotation.countDocuments({ createdBy: { $in: userIdsToQuery }, status: "Pending Approval" });
            const myApprovedQ = await Quotation.countDocuments({ createdBy: { $in: userIdsToQuery }, status: "Approved" });

            // Revenue from approved quotations
            const approvedQData = await Quotation.find({ createdBy: { $in: userIdsToQuery }, status: "Approved" });
            const myRevenue = approvedQData.reduce((s, q) => s + (q.totalAmount || 0), 0);

            // Recent leads
            const recentLeads = await Lead.find({ createdBy: { $in: userIdsToQuery } }).sort({ createdAt: -1 }).limit(5).select("customerName status contactNumber createdAt");

            data = {
                ...data,
                leads: { myTotal: myLeads, pending: myPendingLeads, closedWon: myClosedWon, inProgress: myInProgress, lost: myLost },
                quotations: { myTotal: myQuotations, pending: myPendingQ, approved: myApprovedQ },
                revenue: myRevenue,
                recentLeads
            };
        }

        // ====== OPERATION HEAD - Project & Task Overview ======
        else if (isOpsHead) {
            // Projects managed by this ops head
            const myProjects = await Project.countDocuments({ operationHead: userId });
            const myActiveProjects = await Project.countDocuments({ operationHead: userId, status: "In Progress" });
            const myCompletedProjects = await Project.countDocuments({ operationHead: userId, status: "Completed" });
            const myPendingProjects = await Project.countDocuments({ operationHead: userId, status: "Pending" });

            // Tasks assigned by this ops head
            const myAssignedTasks = await Task.countDocuments({ assignedBy: userId });
            const pendingApproval = await Task.countDocuments({ assignedBy: userId, status: "Submitted" });
            const tasksDone = await Task.countDocuments({ assignedBy: userId, status: "Completed" });
            const tasksOverdue = await Task.countDocuments({ assignedBy: userId, dueDate: { $lt: new Date() }, status: { $in: ["Pending", "In Progress", "Rejected"] } });

            // Payment for my projects
            const myProjectsList = await Project.find({ operationHead: userId }).select("_id lead");
            const myProjectIds = myProjectsList.map(p => p._id);
            const myProjectLeads = myProjectsList.map(p => p.lead);

            const myPayments = await Payment.find({ 
                $or: [
                    { project: { $in: myProjectIds } },
                    { lead: { $in: myProjectLeads } }
                ]
            });
            const myRevenue = myPayments.reduce((s, p) => s + (p.totalAmount || 0), 0);
            const myCollected = myPayments.reduce((s, p) => s + (p.paidAmount || 0), 0);
            const myPendingAmount = myPayments.reduce((s, p) => s + (p.balanceAmount || 0), 0);

            // Pending approval tasks list
            const pendingApprovalList = await Task.find({ assignedBy: userId, status: "Submitted" })
                .populate("assignedTo", "name")
                .populate("project", "customerName")
                .limit(5)
                .select("taskName submittedAt");

            // Overdue tasks list
            const overdueTasksList = await Task.find({ assignedBy: userId, dueDate: { $lt: new Date() }, status: { $in: ["Pending", "In Progress"] } })
                .populate("assignedTo", "name")
                .populate("project", "customerName")
                .limit(5)
                .select("taskName dueDate status");

            data = {
                ...data,
                projects: { my: myProjects, active: myActiveProjects, completed: myCompletedProjects, pending: myPendingProjects },
                tasks: { assigned: myAssignedTasks, pendingApproval, completed: tasksDone, overdue: tasksOverdue },
                payments: { totalRevenue: myRevenue, totalCollected: myCollected, totalPending: myPendingAmount },
                pendingApprovalList,
                overdueTasksList
            };
        }

        // ====== EMPLOYEE - My Task Overview ======
        else {
            const myTasks = await Task.countDocuments({ assignedTo: userId });
            const myPending = await Task.countDocuments({ assignedTo: userId, status: "Pending" });
            const myInProgress = await Task.countDocuments({ assignedTo: userId, status: "In Progress" });
            const mySubmitted = await Task.countDocuments({ assignedTo: userId, status: "Submitted" });
            const myCompleted = await Task.countDocuments({ assignedTo: userId, status: "Completed" });
            const myRejected = await Task.countDocuments({ assignedTo: userId, status: "Rejected" });
            const myOverdue = await Task.countDocuments({ assignedTo: userId, dueDate: { $lt: new Date() }, status: { $in: ["Pending", "In Progress", "Rejected"] } });

            const myRecentTasks = await Task.find({ assignedTo: userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate("project", "customerName")
                .select("taskName status dueDate isTATBreached");

            data = {
                ...data,
                tasks: { total: myTasks, pending: myPending, inProgress: myInProgress, submitted: mySubmitted, completed: myCompleted, rejected: myRejected, overdue: myOverdue },
                recentTasks: myRecentTasks
            };
        }

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("[Dashboard Error]", error);
        res.status(500).json({ error: error.message });
    }
};
