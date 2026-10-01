const Role = require("../models/Role");

// Create a new role (Admin will use this to dynamically create roles)
exports.createRole = async (req, res) => {
    try {
        const { name, permissions } = req.body;
        
        // Check if role exists
        const roleExists = await Role.findOne({ name });
        if (roleExists) {
            return res.status(400).json({ message: "Role already exists" });
        }

        const role = await Role.create({ name, permissions });
        res.status(201).json({ message: "Role created successfully", role });
    } catch (error) {
        res.status(500).json({ message: "Error creating role", error: error.message });
    }
};

// Get all roles
exports.getRoles = async (req, res) => {
    try {
        const roles = await Role.find();
        res.status(200).json(roles);
    } catch (error) {
        res.status(500).json({ message: "Error fetching roles", error: error.message });
    }
};

// Edit a role
exports.updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, permissions } = req.body;

        const role = await Role.findById(id);
        if (!role) {
            return res.status(404).json({ message: "Role not found" });
        }

        // Protect Super Admin Role from being edited
        if (role.name === "Admin") {
            return res.status(403).json({ message: "Action Not Allowed: You cannot edit the Super Admin role." });
        }

        role.name = name || role.name;
        role.permissions = permissions || role.permissions;

        const updatedRole = await role.save();
        res.status(200).json({ message: "Role updated successfully", role: updatedRole });
    } catch (error) {
        res.status(500).json({ message: "Error updating role", error: error.message });
    }
};

// Delete a role
exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        const role = await Role.findById(id);
        if (!role) {
            return res.status(404).json({ message: "Role not found" });
        }

        // Protect Super Admin Role from being deleted
        if (role.name === "Admin") {
            return res.status(403).json({ message: "Action Not Allowed: You cannot delete the Super Admin role." });
        }

        await role.deleteOne();
        res.status(200).json({ message: "Role deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting role", error: error.message });
    }
};
