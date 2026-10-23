require("dotenv").config();
const mongoose = require("mongoose");
const Lead = require("./models/Lead");

const clearData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");
        
        const result = await Lead.deleteMany({});
        console.log(`Successfully deleted ${result.deletedCount} leads.`);
        
        process.exit();
    } catch (error) {
        console.error("Error clearing data:", error);
        process.exit(1);
    }
};

clearData();
