const mongoose = require("mongoose");
const Role = require("../models/Role");
const User = require("../models/User");
const connectDB = require("../config/db");
require("dotenv").config();

const createNewAdmin = async () => {
    try {
        await connectDB();
        
        const adminRole = await Role.findOne({ name: "Admin" });
        if (!adminRole) {
            console.log("Admin role not found!");
            process.exit(1);
        }

        const newAdminEmail = "newadmin@digicoders.com";
        const adminExists = await User.findOne({ email: newAdminEmail });

        if (adminExists) {
            console.log("This new admin already exists!");
            process.exit(0);
        }

        await User.create({
            name: "Super Admin 2",
            email: newAdminEmail,
            password: "newadmin123", // plain text as per existing code
            role: adminRole._id,
            profileImage: "",
            phone: "1234567890",
            department: "Management",
            employeeId: "SA-02",
            company: "Digicoders",
            location: "HQ"
        });

        console.log(`New Super Admin created successfully! Email: ${newAdminEmail}, Password: newadmin123`);
        process.exit(0);
    } catch (error) {
        console.error("Error creating new admin:", error);
        process.exit(1);
    }
};

createNewAdmin();
