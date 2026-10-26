const mongoose = require("mongoose");
require("dotenv").config({ path: "./backend/.env" });

async function clearBusinessData() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully.\n");

        const db = mongoose.connection.db;

        // 1. Identify collections to clear completely
        const businessCollections = [
            "leads",
            "quotations",
            "projects",
            "tasks",
            "payments",
            "expenses",
            "customerdocuments",
            "incentivetransactions"
        ];

        console.log("=== DELETING BUSINESS TRANSACTION DATA ===");
        for (const colName of businessCollections) {
            const count = await db.collection(colName).countDocuments();
            if (count > 0) {
                const res = await db.collection(colName).deleteMany({});
                console.log(`✓ Deleted ${res.deletedCount} documents from '${colName}'`);
            } else {
                console.log(`- '${colName}' is already empty.`);
            }
        }

        // 2. Clear Customer users, preserve Super Admin & Staff employees
        const customerRole = await db.collection("roles").findOne({ name: "Customer" });
        const customerRoleId = customerRole ? customerRole._id : null;

        const preserveEmails = [
            "digitalgurucse@gmail.com",
            "admin@digicoders.com",
            "shbm71194@gmail.com",
            "abc@gmal.com",
            "abcd@gmal.com",
            "abcde@gmail.com",
            "abcdefg@gmail.com"
        ];

        const userDeleteFilter = {
            $or: [
                ...(customerRoleId ? [{ role: customerRoleId }] : []),
                { email: { $nin: preserveEmails } }
            ]
        };

        const usersToDelete = await db.collection("users").find(userDeleteFilter).toArray();
        console.log(`\n=== CUSTOMER USERS TO DELETE (${usersToDelete.length}) ===`);
        usersToDelete.forEach(u => console.log(`- ${u.name} (${u.email})`));

        if (usersToDelete.length > 0) {
            const userRes = await db.collection("users").deleteMany(userDeleteFilter);
            console.log(`✓ Deleted ${userRes.deletedCount} customer/non-staff users from 'users'`);
        }

        // 3. Verify remaining users
        const remainingUsers = await db.collection("users").find({}).toArray();
        console.log(`\n=== REMAINING ACTIVE USERS (${remainingUsers.length}) ===`);
        remainingUsers.forEach(u => console.log(`- ${u.name} (${u.email})`));

        // 4. Verify Master Data is completely intact
        const rolesCount = await db.collection("roles").countDocuments();
        const deptsCount = await db.collection("departments").countDocuments();
        const tplCount = await db.collection("tasktemplates").countDocuments();
        const docTypesCount = await db.collection("documenttypes").countDocuments();
        const productsCount = await db.collection("products").countDocuments();
        const settingsCount = await db.collection("settings").countDocuments();

        console.log("\n=== MASTER DATA INTEGRITY CHECK ===");
        console.log(`- Roles: ${rolesCount}`);
        console.log(`- Departments: ${deptsCount}`);
        console.log(`- Task Templates: ${tplCount}`);
        console.log(`- Document Types: ${docTypesCount}`);
        console.log(`- Products: ${productsCount}`);
        console.log(`- Settings: ${settingsCount}`);

        console.log("\nData clearance completed successfully.");
    } catch (err) {
        console.error("Error during data clearance:", err);
    } finally {
        await mongoose.disconnect();
    }
}

clearBusinessData();
