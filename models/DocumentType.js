const mongoose = require("mongoose");

const documentTypeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    isRequired: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("DocumentType", documentTypeSchema);
