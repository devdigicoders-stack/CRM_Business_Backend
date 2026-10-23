const cron = require('node-cron');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// Run every minute for testing
const checkTATBreaches = () => {
    cron.schedule('* * * * *', async () => {
        console.log(`[${new Date().toLocaleTimeString()}] Running TAT Breach Checker Cron Job...`);
        
        try {
            const now = new Date();
            
            // 1. Employee TAT Breach (Task Assigned but Not Submitted OR Rejected and pending resubmission)
            const inProgressTasks = await Task.find({ status: { $in: ['Pending', 'In Progress', 'Rejected'] } }).populate('assignedTo');
            for (let task of inProgressTasks) {
                // Check if deadline has passed AND it hasn't been breached yet
                if (task.dueDate && task.dueDate < now && !task.isTATBreached) {
                    task.isTATBreached = true;
                    await task.save();
                    
                    if (task.assignedTo && task.assignedTo.email) {
                        try {
                            console.log(`[TAT Breach] Sending email to Employee: ${task.assignedTo.email} for task "${task.taskName}"...`);
                            const success = await sendEmail({
                                email: task.assignedTo.email,
                                subject: `TAT Breached: Task "${task.taskName}" is Overdue!`,
                                message: `Hello ${task.assignedTo.name},\n\nYour assigned task "${task.taskName}" has breached its TAT (Turn Around Time). Please complete it immediately.\n\nCRM Automation`
                            });
                            if (success) {
                                console.log(`[Success] Email sent to Employee: ${task.assignedTo.email}`);
                            } else {
                                console.log(`[Failed] Could not send email to Employee: ${task.assignedTo.email}`);
                            }
                        } catch (err) {
                            console.error(`[Error] Failed to send email to ${task.assignedTo.email}:`, err.message);
                        }
                    }
                }
            }

            // 2. Ops Head Approval Reminder (Task Submitted but not Approved for 24h)
            const submittedTasks = await Task.find({ status: 'Submitted' }).populate('assignedBy');
            for (let task of submittedTasks) {
                if (task.submittedAt) {
                    const diffHours = Math.abs(now - task.submittedAt) / 36e5;
                    const reminderHours = task.opsHeadReminderHours || 24;
                    // If more than reminderHours have passed since submission
                    if (diffHours > reminderHours) {
                        if (task.assignedBy && task.assignedBy.email) {
                            try {
                                console.log(`[Approval Reminder] Sending email to Ops Head: ${task.assignedBy.email} for task "${task.taskName}"...`);
                                await sendEmail({
                                    email: task.assignedBy.email,
                                    subject: `Action Required: Task "${task.taskName}" Pending Approval`,
                                    message: `Hello ${task.assignedBy.name},\n\nThe task "${task.taskName}" was submitted more than 24 hours ago and is awaiting your approval.\n\nCRM Automation`
                                });
                                console.log(`[Success] Email sent to Ops Head: ${task.assignedBy.email}`);
                            } catch (err) {
                                console.error(`[Error] Failed to send email to ${task.assignedBy.email}:`, err.message);
                            }
                        }
                    }
                }
            }

            // 3. Next Task Assignment Reminder
            // (If Project current task is approved, but the NEXT task is not yet assigned/created)
            // For this, we'll check Projects that are "In Progress"
            const activeProjects = await Project.find({ status: 'In Progress' }).populate('operationHead');
            for (let project of activeProjects) {
                // Find the latest completed task for this project
                const lastCompletedTask = await Task.findOne({ project: project._id, stepNumber: project.currentStep - 1, status: 'Completed' });
                
                if (lastCompletedTask && lastCompletedTask.approvedAt) {
                    const diffHours = Math.abs(now - lastCompletedTask.approvedAt) / 36e5;
                    const delayHours = lastCompletedTask.opsHeadReminderHours || 24; // Use template setting
                    if (diffHours > delayHours) {
                        // Check if the current step task exists and is assigned
                        const currentTask = await Task.findOne({ project: project._id, stepNumber: project.currentStep });
                        if (!currentTask || !currentTask.assignedTo) {
                            if (project.operationHead && project.operationHead.email) {
                                try {
                                    console.log(`[Delay Alert] Sending email to Ops Head: ${project.operationHead.email} for project "${project.customerName}"...`);
                                    await sendEmail({
                                        email: project.operationHead.email,
                                        subject: `Delay Alert: Next Task Unassigned for Project "${project.customerName}"`,
                                        message: `Hello ${project.operationHead.name},\n\nThe previous task for project "${project.customerName}" was approved over 24 hours ago, but the next task (Step ${project.currentStep}) has not been assigned yet. Please assign it immediately to keep the pipeline moving.\n\nCRM Automation`
                                    });
                                    console.log(`[Success] Email sent to Ops Head: ${project.operationHead.email}`);
                                } catch(err) {
                                    console.error(`[Error] Failed to send email to ${project.operationHead.email}:`, err.message);
                                }
                            }
                        }
                    }
                }
            }

            console.log('TAT Breach Checker Cron Job Completed successfully.');
        } catch (error) {
            console.error('Error running TAT cron job:', error);
        }
    });
};

module.exports = { checkTATBreaches };
