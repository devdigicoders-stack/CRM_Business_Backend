const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true, // Example: 'Admin', 'Sales Manager'
    },
    permissions: [{
        type: String // Example: 'view_leads', 'create_user'
    }]
}, { timestamps: true });

module.exports = mongoose.model("Role", roleSchema);
