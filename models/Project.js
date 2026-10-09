const mongoose = require("mongoose");

const workflowHistorySchema = new mongoose.Schema({
    fromStage: { type: String },
    toStage: { type: String, required: true },
    movedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    date: { type: Date, default: Date.now },
    remarks: { type: String }
});

const projectSchema = new mongoose.Schema({
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true }, // Link to converted lead
    customerName: { type: String, required: true },
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation" }, // The approved bill
    operationHead: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Ops head handling it
    
    // Overall Status
    status: { type: String, enum: ["Pending", "In Progress", "Completed", "On Hold"], default: "Pending" },
    
    // Department Workflow Stages
    workflowStage: { 
        type: String, 
        enum: ["Pending Registration", "Bank Coordination", "Installation", "Completed"], 
        default: "Pending Registration" 
    },
    workflowHistory: [workflowHistorySchema],
    
    currentStep: { type: Number, default: 1 }, // Tracks the current active task step from TaskTemplates

    // Final Handover / Hardware tracking (Added for receipt generation)
    installedEquipments: [{
        itemName: { type: String, required: true },
        serialNumber: { type: String, required: true },
        quantity: { type: Number, default: 1 }
    }],

    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    remarks: { type: String }
}, { timestamps: true });

module.exports = mongoose.model("Project", projectSchema);
