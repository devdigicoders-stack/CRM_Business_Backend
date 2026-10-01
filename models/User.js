const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
        required: true
    },
    profileImage: {
        type: String, // Store image path string
        default: ""
    },
    phone: { type: String, default: "" },
    department: { type: String, default: "" },
    employeeId: { type: String, default: "", sparse: true },
    company: { type: String, default: "" },
    location: { type: String, default: "" },
    reportingManager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
