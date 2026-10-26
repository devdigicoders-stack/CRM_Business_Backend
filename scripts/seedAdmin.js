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

        // 2. Check if Super Admin User exists, otherwise create it or update old admin email
        const adminEmail = process.env.ADMIN_EMAIL || process.env.Email || "digitalgurucse@gmail.com";
        const adminPassword = process.env.Password || "vivek@7068";
        
        let adminUser = await User.findOne({ email: adminEmail });
        
        if (!adminUser) {
            // Check if user with previous email exists, if so migrate to new email
            const oldAdmin = await User.findOne({ email: "admin@digicoders.com" });
            if (oldAdmin) {
                oldAdmin.email = adminEmail;
                oldAdmin.role = adminRole._id;
                if (process.env.Password) {
                    oldAdmin.password = adminPassword;
                }
                await oldAdmin.save();
                console.log(`Super Admin email updated from admin@digicoders.com to ${adminEmail}`);
                adminUser = oldAdmin;
            } else {
                await User.create({
                    name: "Super Admin",
                    email: adminEmail,
                    password: adminPassword,
                    role: adminRole._id,
                    profileImage: ""
                });
                console.log(`Super Admin User (${adminEmail}) Created Successfully!`);
            }
        }

    } catch (error) {
        console.error("Error Seeding Admin:", error);
    }
};

module.exports = seedSuperAdmin;
