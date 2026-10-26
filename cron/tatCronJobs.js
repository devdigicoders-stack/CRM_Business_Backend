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
            .populate('department')
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
            if (!task.tatBreachEmailSent) {
                try {
                    const superAdminEmail = process.env.ADMIN_EMAIL || process.env.Email || "digitalgurucse@gmail.com";
                    const customerName = task.project?.customerName || 'N/A';
                    const assignedName = task.assignedTo?.name || 'Unassigned / Unknown';
                    const assignedEmail = task.assignedTo?.email || 'N/A';
                    const assignedPhone = task.assignedTo?.phone || '';
                    const departmentName = task.department?.name || 'Operations';
                    const stepNum = task.stepNumber || 1;

                    // Calculate overdue duration
                    const overdueMs = Math.max(0, now - new Date(task.dueDate));
                    const overdueHours = Math.floor(overdueMs / (1000 * 60 * 60));
                    const overdueMinutes = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));
                    const overdueDurationText = overdueHours >= 24 
                        ? `${Math.floor(overdueHours / 24)} Din ${overdueHours % 24} Ghante`
                        : `${overdueHours} Ghante ${overdueMinutes} Minute`;

                    const recipients = [superAdminEmail];
                    if (task.assignedTo?.email && !recipients.includes(task.assignedTo.email)) {
                        recipients.push(task.assignedTo.email);
                    }

                    console.log(`[TAT Breach] Sending Overdue email to: ${recipients.join(', ')} for task "${task.taskName}" (Assigned To: ${assignedName})...`);
                    
                    let anySuccess = false;
                    for (const recipient of recipients) {
                        const isSuperAdmin = (recipient === superAdminEmail);

                        const subject = isSuperAdmin
                            ? `⚠️ Overdue Alert: Task "${task.taskName}" (${assignedName} ka task pending hai)`
                            : `TAT Breached: Task "${task.taskName}" is Overdue!`;

                        const plainTextMessage = isSuperAdmin
                            ? `Hello Super Admin,\n\nCRM me ek task ki deadline breach ho gayi hai aur yeh task abhi tak submit/complete nahi hua hai.\n\n========================================\nDETAILS:\n- Kiska Task Pending Hai: ${assignedName} (${assignedEmail})\n${assignedPhone ? `- Contact Number: ${assignedPhone}\n` : ''}- Task Name: ${task.taskName} (Step ${stepNum})\n- Project / Customer: ${customerName}\n- Department: ${departmentName}\n- Due Date: ${new Date(task.dueDate).toLocaleString()}\n- Overdue Duration: ${overdueDurationText}\n- Current Status: OVERDUE\n========================================\n\nKripya employee ${assignedName} se sampark karein ya CRM Dashboard par check karein.\n\nRAM MILAN SINGH`
                            : `Hello ${assignedName},\n\nYour assigned task "${task.taskName}" for project "${customerName}" has breached its TAT deadline (${new Date(task.dueDate).toLocaleString()}).\nOverdue Time: ${overdueDurationText}.\n\nPlease complete and submit all required documents immediately to avoid workflow delays.\n\nRAM MILAN SINGH`;

                        const htmlMessage = isSuperAdmin
                            ? `<h3 style="color: #dc2626; margin-top: 0;">⚠️ Task Overdue Alert (TAT Breached)</h3>
                               <p>Hello Super Admin,</p>
                               <p>CRM me ek task ki deadline breach ho gayi hai aur yeh task abhi tak submit/complete nahi hua hai:</p>
                               <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
                                   <tr style="border-bottom: 1px solid #f1f5f9;">
                                       <td style="padding: 8px 0; font-weight: bold; color: #475569; width: 40%;">👤 Kiska Task Pending Hai:</td>
                                       <td style="padding: 8px 0; font-weight: bold; color: #0f172a;">${assignedName} (${assignedEmail})</td>
                                   </tr>
                                   ${assignedPhone ? `<tr style="border-bottom: 1px solid #f1f5f9;">
                                       <td style="padding: 8px 0; font-weight: bold; color: #475569;">📞 Contact Number:</td>
                                       <td style="padding: 8px 0; color: #0f172a;">${assignedPhone}</td>
                                   </tr>` : ''}
                                   <tr style="border-bottom: 1px solid #f1f5f9;">
                                       <td style="padding: 8px 0; font-weight: bold; color: #475569;">📋 Task Name:</td>
                                       <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${task.taskName} (Step ${stepNum})</td>
                                   </tr>
                                   <tr style="border-bottom: 1px solid #f1f5f9;">
                                       <td style="padding: 8px 0; font-weight: bold; color: #475569;">🏢 Customer / Project:</td>
                                       <td style="padding: 8px 0; color: #0f172a;">${customerName}</td>
                                   </tr>
                                   <tr style="border-bottom: 1px solid #f1f5f9;">
                                       <td style="padding: 8px 0; font-weight: bold; color: #475569;">🏷️ Department:</td>
                                       <td style="padding: 8px 0; color: #0f172a;">${departmentName}</td>
                                   </tr>
                                   <tr style="border-bottom: 1px solid #f1f5f9;">
                                       <td style="padding: 8px 0; font-weight: bold; color: #475569;">⏰ Due Date:</td>
                                       <td style="padding: 8px 0; color: #dc2626; font-weight: 600;">${new Date(task.dueDate).toLocaleString()}</td>
                                   </tr>
                                   <tr style="border-bottom: 1px solid #f1f5f9;">
                                       <td style="padding: 8px 0; font-weight: bold; color: #475569;">⏳ Overdue Time:</td>
                                       <td style="padding: 8px 0; color: #dc2626; font-weight: bold;">${overdueDurationText}</td>
                                   </tr>
                                   <tr>
                                       <td style="padding: 8px 0; font-weight: bold; color: #475569;">📌 Current Status:</td>
                                       <td style="padding: 8px 0;"><span style="background-color: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">OVERDUE</span></td>
                                   </tr>
                               </table>
                               <p style="margin-top: 15px; font-size: 13px; color: #64748b;">Kripya employee <b>${assignedName}</b> se sampark karein ya CRM Dashboard par check karein.</p>`
                            : null;

                        const success = await sendEmail({
                            email: recipient,
                            subject,
                            message: plainTextMessage,
                            html: htmlMessage
                        });

                        if (success) {
                            anySuccess = true;
                            console.log(`[Success] Overdue email sent to: ${recipient}`);
                        } else {
                            console.log(`[Failed] Could not send overdue email to: ${recipient}`);
                        }
                    }

                    if (anySuccess) {
                        task.tatBreachEmailSent = true;
                        needsSave = true;
                        breachEmailsSent++;
                    }
                } catch (err) {
                    console.error(`[Error] Failed to process overdue email for task "${task.taskName}":`, err.message);
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
                                message: `Hello ${targetOpsHead.name},\n\nThe task "${task.taskName}"${customerInfo} was submitted ${Math.floor(diffHours)} hours ago and is awaiting your review.\n\nPlease log in to the CRM to approve or reject the submission.\n\nRAM MILAN SINGH`
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
                                    message: `Hello ${project.operationHead.name},\n\nThe previous task for project "${project.customerName}" was approved over 24 hours ago, but Step ${project.currentStep} has not been assigned yet. Please assign it immediately.\n\nRAM MILAN SINGH`
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
