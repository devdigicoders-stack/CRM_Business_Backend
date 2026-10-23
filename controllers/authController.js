const User = require("../models/User");
const Role = require("../models/Role"); // Import Role to check role name
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Register a new user
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, role, phone, department, employeeId, company, location, reportingManager } = req.body;
        const profileImage = req.file ? `/uploads/${req.file.filename}` : "";

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "User already exists with this email" });
        }

        // Check if employeeId is already taken
        if (employeeId && employeeId.trim() !== "") {
            const empIdExists = await User.findOne({ employeeId: employeeId.trim() });
            if (empIdExists) {
                return res.status(400).json({ message: `Employee ID "${employeeId}" is already assigned to another user. Please use a unique Employee ID.` });
            }
        }

        // Security Check: Prevent anyone from creating an 'Admin' role user
        const roleData = await Role.findById(role);
        if (!roleData) {
            return res.status(400).json({ message: "Invalid Role ID" });
        }
        if (roleData.name === "Admin") {
            return res.status(403).json({ message: "Action Not Allowed: You cannot assign the 'Admin' role to a new user." });
        }

        // Create user with plain text password
        const newUser = await User.create({
            name,
            email,
            password, // Plain text password (as requested)
            role,
            profileImage,
            phone,
            department,
            employeeId: employeeId ? employeeId.trim() : "",
            company,
            location,
            reportingManager: reportingManager || null
        });

        res.status(201).json({ message: "User registered successfully", user: newUser });
    } catch (error) {
        res.status(500).json({ message: "Error in registration", error: error.message });
    }
};

// Login user
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists and populate the role to get permissions
        const user = await User.findOne({ email }).populate("role");
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Compare password directly (plain text)
        if (password !== user.password) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user._id, role: user.role.name }, 
            process.env.JWT_SECRET || "digicoders_secret_key", 
            { expiresIn: "1d" }
        );

        res.status(200).json({ message: "Login successful", token, user });
    } catch (error) {
        res.status(500).json({ message: "Error in login", error: error.message });
    }
};

// Get User Profile
exports.getProfile = async (req, res) => {
    try {
        // req.user is set by the protect middleware
        const user = await User.findById(req.user.id).select("-password").populate("role");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ message: "Error fetching profile", error: error.message });
    }
};

// Edit User Profile
exports.editProfile = async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.name = name || user.name;
        user.email = email || user.email;
        if (phone !== undefined) user.phone = phone;

        // If a new profile image is uploaded, update it
        if (req.file) {
            user.profileImage = `/uploads/${req.file.filename}`;
        }

        const updatedUser = await user.save();

        res.status(200).json({ 
            message: "Profile updated successfully", 
            user: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                profileImage: updatedUser.profileImage
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Error updating profile", error: error.message });
    }
};

// Change Password
exports.changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if old password matches directly
        if (oldPassword !== user.password) {
            return res.status(400).json({ message: "Incorrect old password" });
        }

        // Save the new password as plain text
        user.password = newPassword;

        await user.save();

        res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error changing password", error: error.message });
    }
};

// Get All Users (For Admin/HR to view all staff, excludes Customers)
exports.getAllUsers = async (req, res) => {
    try {
        const userRole = req.user.role?.name;
        const bypassHierarchy = req.query.all === 'true';
        let query = {};

        // Find customer role so we can exclude customers from staff list
        const customerRole = await Role.findOne({ name: "Customer" });
        if (customerRole) {
            query.role = { $ne: customerRole._id };
        }

        // If they are Admin OR bypassHierarchy is true, they see everyone.
        // If they are anything else (like Sales Manager or Operation Head), they only see their hierarchy.
        if (userRole !== "Admin" && !bypassHierarchy) {
            query.$or = [
                { reportingManager: req.user.id },
                { _id: req.user.id }
            ];
        }

        // Exclude passwords from the response, populate role and reportingManager
        const users = await User.find(query)
            .select("-password")
            .populate("role")
            .populate("reportingManager", "name role email");
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: "Error fetching users", error: error.message });
    }
};

// Get All Customers (Accessible to all staff, hidden from customers)
exports.getAllCustomers = async (req, res) => {
    try {
        if (req.user.role?.name === "Customer") {
            return res.status(403).json({ message: "Access Denied: Customers cannot view customer list" });
        }

        const customerRole = await Role.findOne({ name: "Customer" });
        if (!customerRole) {
            return res.status(200).json([]);
        }

        const customers = await User.find({ role: customerRole._id })
            .select("-password")
            .populate("role", "name")
            .sort({ createdAt: -1 });

        res.status(200).json(customers);
    } catch (error) {
        res.status(500).json({ message: "Error fetching customers", error: error.message });
    }
};

// Get Assignable Users (Hierarchy-aware: for Lead Assign dropdown, excludes Customers)
exports.getAssignableUsers = async (req, res) => {
    try {
        const userRole = req.user.role?.name;
        let users = [];

        const customerRole = await Role.findOne({ name: "Customer" });
        const excludeCustomer = customerRole ? { role: { $ne: customerRole._id } } : {};

        if (userRole === "Admin") {
            // Admin sees all active staff except themselves
            users = await User.find({ isActive: true, _id: { $ne: req.user.id }, ...excludeCustomer })
                .select("-password")
                .populate("role", "name");
        } else if (userRole === "Sales Manager") {
            // Manager sees only their direct children (reportingManager = this manager)
            users = await User.find({ 
                reportingManager: req.user.id,
                isActive: true,
                ...excludeCustomer
            })
                .select("-password")
                .populate("role", "name");
        } else {
            return res.status(200).json([]);
        }

        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: "Error fetching assignable users", error: error.message });
    }
};

// Admin: Edit User
exports.adminEditUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, phone, department, employeeId, company, location, reportingManager } = req.body;

        const user = await User.findById(id).populate("role");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.role && user.role.name === "Admin") {
            return res.status(403).json({ message: "Action Not Allowed: You cannot edit the Super Admin." });
        }

        user.name = name || user.name;
        user.email = email || user.email;
        if (role) user.role = role;
        user.phone = phone !== undefined ? phone : user.phone;
        user.department = department !== undefined ? department : user.department;
        user.employeeId = employeeId !== undefined ? employeeId : user.employeeId;
        user.company = company !== undefined ? company : user.company;
        user.location = location !== undefined ? location : user.location;
        
        if (reportingManager === "" || reportingManager === "null") {
            user.reportingManager = null;
        } else if (reportingManager) {
            user.reportingManager = reportingManager;
        }

        if (req.file) {
            user.profileImage = `/uploads/profiles/${req.file.filename}`;
        }

        await user.save();
        res.status(200).json({ message: "User updated successfully", user });
    } catch (error) {
        res.status(500).json({ message: "Error updating user", error: error.message });
    }
};

// Admin: Delete User
exports.adminDeleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id).populate("role");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.role && user.role.name === "Admin") {
            return res.status(403).json({ message: "Action Not Allowed: You cannot delete the Super Admin." });
        }

        await user.deleteOne();
        res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting user", error: error.message });
    }
};

// Admin: Toggle User Active/Inactive Status
exports.adminToggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id).populate("role");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.role && user.role.name === "Admin") {
            return res.status(403).json({ message: "Action Not Allowed: You cannot change status of Super Admin." });
        }

        user.isActive = !user.isActive; // Toggle boolean
        await user.save();

        res.status(200).json({ message: `User is now ${user.isActive ? 'Active' : 'Inactive'}`, isActive: user.isActive });
    } catch (error) {
        res.status(500).json({ message: "Error toggling status", error: error.message });
    }
};

// Admin: Change Any User's / Customer's Password (Super Admin Only)
exports.adminChangeUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        const isSuperAdmin = req.user.role?.name === "Admin" || req.user.role?.name === "Super Admin";
        if (!isSuperAdmin) {
            return res.status(403).json({ message: "Action Not Allowed: Only Super Admin can change passwords." });
        }

        const user = await User.findById(id).populate("role");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.role && user.role.name === "Admin" && req.user.id !== user._id.toString()) {
            return res.status(403).json({ message: "Action Not Allowed: You cannot change password of Super Admin." });
        }

        user.password = newPassword; // Saving as plain text as requested earlier
        await user.save();

        res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error changing password", error: error.message });
    }
};

// Admin: Delete Customer
exports.deleteCustomer = async (req, res) => {
    try {
        const isSuperAdmin = req.user.role?.name === "Admin" || req.user.role?.name === "Super Admin";
        if (!isSuperAdmin) {
            return res.status(403).json({ message: "Access Denied: Only Super Admin can delete customers" });
        }

        const customer = await User.findById(req.params.id).populate("role");
        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }

        if (customer.role?.name !== "Customer") {
            return res.status(400).json({ message: "Action Denied: This action can only delete customers" });
        }

        // Clean up linked customer documents if any
        try {
            const CustomerDocument = require("../models/CustomerDocument");
            if (customer.email) {
                const Lead = require("../models/Lead");
                const linkedLead = await Lead.findOne({ email: customer.email });
                if (linkedLead) {
                    await CustomerDocument.deleteMany({ lead: linkedLead._id });
                }
            }
        } catch (e) {
            console.error("Error cleaning customer documents:", e);
        }

        await customer.deleteOne();
        res.status(200).json({ message: "Customer deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting customer", error: error.message });
    }
};

