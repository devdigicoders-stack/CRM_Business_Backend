const cron = require('node-cron');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// Core function to check and process TAT breaches and reminders
const runTATBreachCheckNow = async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Running TAT Breach Checker...`);
    const now = new Date();
    let breachEmailsSent = 0;
    let approvalRemindersSent = 0;
    let delayAlertsSent = 0;

    try {
        // 1. Employee TAT Breach (Task Assigned but Not Submitted/Approved/Completed)
        const overdueTasks = await Task.find({
            status: { $in: ['Pending', 'In Progress', 'Rejected', 'Overdue'] },
            dueDate: { $lt: now }
        })
            .populate('assignedTo')
            .populate('project');

        for (let task of overdueTasks) {
            let needsSave = false;

            // Mark as breached & status as Overdue if not already
            if (!task.isTATBreached) {
                task.isTATBreached = true;
                needsSave = true;
            }

            if (task.status !== 'Completed' && task.status !== 'Submitted' && task.status !== 'Approved' && task.status !== 'Overdue') {
                task.status = 'Overdue';
                needsSave = true;
            }

            // Send Overdue Email if not sent yet
            if (!task.tatBreachEmailSent && task.assignedTo && task.assignedTo.email) {
                try {
                    console.log(`[TAT Breach] Sending email to Employee: ${task.assignedTo.email} for task "${task.taskName}"...`);
                    const customerInfo = task.project?.customerName ? ` for Project: "${task.project.customerName}"` : '';
                    
                    const success = await sendEmail({
                        email: task.assignedTo.email,
                        subject: `TAT Breached: Task "${task.taskName}" is Overdue!`,
                        message: `Hello ${task.assignedTo.name},\n\nYour assigned task "${task.taskName}"${customerInfo} has breached its TAT (Turn Around Time) deadline (${new Date(task.dueDate).toLocaleString()}).\n\nPlease complete and submit all required documents immediately to avoid workflow delays.\n\nCRM Automation`
                    });

                    if (success) {
                        task.tatBreachEmailSent = true;
                        needsSave = true;
                        breachEmailsSent++;
                        console.log(`[Success] Overdue email sent to Employee: ${task.assignedTo.email}`);
                    } else {
                        console.log(`[Failed] Could not send email to Employee: ${task.assignedTo.email}. Will retry on next check.`);
                    }
                } catch (err) {
                    console.error(`[Error] Failed to send email to ${task.assignedTo.email}:`, err.message);
                }
            }

            if (needsSave) {
                await task.save();
            }
        }

        // 2. Ops Head Approval Reminder (Task Submitted but not Approved for 24h)
        const submittedTasks = await Task.find({
            status: 'Submitted',
            approvalReminderSent: { $ne: true }
        })
            .populate('assignedBy')
            .populate({ path: 'project', populate: { path: 'operationHead' } });

        for (let task of submittedTasks) {
            if (task.submittedAt) {
                const diffHours = Math.abs(now - task.submittedAt) / 36e5;
                const reminderHours = task.opsHeadReminderHours || 24;

                if (diffHours >= reminderHours) {
                    const targetOpsHead = task.assignedBy?.email ? task.assignedBy : task.project?.operationHead;
                    if (targetOpsHead && targetOpsHead.email) {
                        try {
                            console.log(`[Approval Reminder] Sending email to Ops Head: ${targetOpsHead.email} for task "${task.taskName}"...`);
                            const customerInfo = task.project?.customerName ? ` for Project: "${task.project.customerName}"` : '';

                            const success = await sendEmail({
                                email: targetOpsHead.email,
                                subject: `Action Required: Task "${task.taskName}" Pending Approval`,
                                message: `Hello ${targetOpsHead.name},\n\nThe task "${task.taskName}"${customerInfo} was submitted ${Math.floor(diffHours)} hours ago and is awaiting your review.\n\nPlease log in to the CRM to approve or reject the submission.\n\nCRM Automation`
                            });

                            if (success) {
                                task.approvalReminderSent = true;
                                await task.save();
                                approvalRemindersSent++;
                                console.log(`[Success] Approval reminder email sent to Ops Head: ${targetOpsHead.email}`);
                            }
                        } catch (err) {
                            console.error(`[Error] Failed to send email to ${targetOpsHead.email}:`, err.message);
                        }
                    }
                }
            }
        }

        // 3. Next Task Assignment Reminder
        const activeProjects = await Project.find({ status: 'In Progress' }).populate('operationHead');
        for (let project of activeProjects) {
            const lastCompletedTask = await Task.findOne({
                project: project._id,
                stepNumber: project.currentStep - 1,
                status: 'Completed'
            });

            if (lastCompletedTask && lastCompletedTask.approvedAt) {
                const diffHours = Math.abs(now - lastCompletedTask.approvedAt) / 36e5;
                const delayHours = lastCompletedTask.opsHeadReminderHours || 24;

                if (diffHours > delayHours) {
                    const currentTask = await Task.findOne({ project: project._id, stepNumber: project.currentStep });
                    if (!currentTask || !currentTask.assignedTo) {
                        if (project.operationHead && project.operationHead.email) {
                            try {
                                console.log(`[Delay Alert] Sending email to Ops Head: ${project.operationHead.email} for project "${project.customerName}"...`);
                                const success = await sendEmail({
                                    email: project.operationHead.email,
                                    subject: `Delay Alert: Next Task Unassigned for Project "${project.customerName}"`,
                                    message: `Hello ${project.operationHead.name},\n\nThe previous task for project "${project.customerName}" was approved over 24 hours ago, but Step ${project.currentStep} has not been assigned yet. Please assign it immediately.\n\nCRM Automation`
                                });
                                if (success) {
                                    delayAlertsSent++;
                                    console.log(`[Success] Delay alert email sent to Ops Head: ${project.operationHead.email}`);
                                }
                            } catch (err) {
                                console.error(`[Error] Failed to send email to ${project.operationHead.email}:`, err.message);
                            }
                        }
                    }
                }
            }
        }

        console.log(`TAT Breach Checker Completed. (Breach emails: ${breachEmailsSent}, Approvals: ${approvalRemindersSent}, Delay alerts: ${delayAlertsSent})`);
        return {
            success: true,
            breachEmailsSent,
            approvalRemindersSent,
            delayAlertsSent
        };
    } catch (error) {
        console.error('Error running TAT cron job:', error);
        return { success: false, error: error.message };
    }
};

// Scheduled Cron Job (Runs every minute)
const checkTATBreaches = () => {
    cron.schedule('* * * * *', async () => {
        await runTATBreachCheckNow();
    });
};

module.exports = { checkTATBreaches, runTATBreachCheckNow };
