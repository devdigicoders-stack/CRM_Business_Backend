const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    departmentCode: { type: String },
    description: { type: String },
    headOfDepartment: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Link to Manager/HOD
    contactEmail: { type: String },
    contactPhone: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Department", departmentSchema);
