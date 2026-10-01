const Role = require("../models/Role");
const User = require("../models/User");

const seedSuperAdmin = async () => {
    try {
        // 1. Check if 'Admin' role exists, otherwise create it
        let adminRole = await Role.findOne({ name: "Admin" });
        if (!adminRole) {
            adminRole = await Role.create({
                name: "Admin",
                permissions: ["manage_users", "manage_roles", "manage_settings", "view_all_reports", "manage_products", "manage_services", "manage_leads", "manage_quotations", "manage_operations"]
            });
            console.log("Admin Role Created Automatically!");
        }

        // 2. Check if Super Admin User exists, otherwise create it
        const adminEmail = "admin@digicoders.com";
        const adminUser = await User.findOne({ email: adminEmail });
        
        if (!adminUser) {
            await User.create({
                name: "Super Admin",
                email: adminEmail,
                password: "706876", // Password changed as requested
                role: adminRole._id,
                profileImage: ""
            });
            console.log("Super Admin User Created Automatically!");
        }

    } catch (error) {
        console.error("Error Seeding Admin:", error);
    }
};

module.exports = seedSuperAdmin;
