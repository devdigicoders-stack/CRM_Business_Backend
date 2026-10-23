const mongoose = require("mongoose");

const taskRemarkSchema = new mongoose.Schema({
    text: { type: String, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    date: { type: Date, default: Date.now }
});

const taskSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // specific employee in that department
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Usually Ops Head (optional initially)
    stepNumber: { type: Number }, // To track which step this is in the project's sequence
    taskName: { type: String, required: true },
    description: { type: String },
    tatHours: { type: Number, default: 24 },
    opsHeadReminderHours: { type: Number, default: 24 },
    status: { type: String, enum: ["Pending", "In Progress", "Submitted", "Approved", "Completed", "Overdue", "Rejected"], default: "Pending" },
    requiredDocuments: [{ 
        documentName: { type: String, required: true },
        fileUrl: { type: String },
        isUploaded: { type: Boolean, default: false }
    }],
    referenceDocuments: [{ // Documents sent by Admin/Ops Head to the employee for reference
        documentName: { type: String, required: true },
        fileUrl: { type: String, required: true }
    }],
    dueDate: { type: Date }, // Set automatically using TAT when assigned
    assignedAt: { type: Date }, // When Ops Head assigns it to an employee
    submittedAt: { type: Date }, // When employee uploads docs and clicks submit
    approvedAt: { type: Date }, // When Ops Head approves it
    completedAt: { type: Date },
    remarks: [taskRemarkSchema],
    
    // TAT Specific Fields
    isTATBreached: { type: Boolean, default: false }, // Will be set to true if completed past dueDate or currently past dueDate
    tatRemarks: [taskRemarkSchema] // Reasons for TAT breach added by managers
}, { timestamps: true });

module.exports = mongoose.model("Task", taskSchema);
