const mongoose = require("mongoose");
require("dotenv").config();
const Role = require("./models/Role");

const fixAdminPermissions = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const adminRole = await Role.findOne({ name: "Admin" });
        if (adminRole && !adminRole.permissions.includes("manage_services")) {
            adminRole.permissions.push("manage_services");
            await adminRole.save();
            console.log("Admin role updated with manage_services permission!");
        } else {
            console.log("Permission already exists or Admin role not found.");
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

fixAdminPermissions();
