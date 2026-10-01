const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        const Lead = require('./models/Lead');
        const User = require('./models/User'); // Required for populate

        const leads = await Lead.find({
            $or: [
                { isConverted: true },
                { status: "Closed-Won" }
            ]
        })
        .populate("assignedTo", "name email")
        .populate("assignedBy", "name")
        .populate("remarks.addedBy", "name");
        
        console.log("Success! Leads found:", leads.length);
    } catch (e) {
        console.error("ERROR CAUGHT:");
        console.error(e.message);
        console.error(e.stack);
    }
    process.exit(0);
});
