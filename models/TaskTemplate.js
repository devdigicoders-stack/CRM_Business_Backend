const mongoose = require("mongoose");

const taskTemplateSchema = new mongoose.Schema({
    stepNumber: { type: Number, required: true },
    taskName: { type: String, required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    description: { type: String },
    requiredDocuments: [{ type: String }], // Array of strings e.g. ["PSD File", "Source Code Zip"]
    tatHours: { type: Number, default: 24 }, // Expected time to complete in hours
    opsHeadReminderHours: { type: Number, default: 24 } // Time in hours before Ops Head gets approval reminder
}, { timestamps: true });

module.exports = mongoose.model("TaskTemplate", taskTemplateSchema);
