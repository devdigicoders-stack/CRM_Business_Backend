const Settings = require("../models/Settings");

exports.getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            // Create default settings if not exists
            settings = await Settings.create({});
        }
        res.status(200).json(settings);
    } catch (error) {
        res.status(500).json({ message: "Error fetching settings", error: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create(req.body);
        } else {
            // Update all available fields from req.body dynamically
            const updatableFields = [
                "companyName", "companyEmail", "companyPhone", "companyAddress", 
                "companyLogo", "currency", "defaultTaxPercentage", 
                "leadApprovalTAT", "taskCompletionTAT",
                "companySlogan", "quotationSubtitle", "defaultDesignation",
                "termsAndConditions", "whyChooseUs",
                "signatoryName", "signatoryDesignation", "signatoryCompany", "stampCity",
                "digitalSignature", "companyStamp",
                "thankYouNote", "websiteUrl", "linkedinUrl", "instagramUrl", "facebookUrl", "youtubeUrl"
            ];
            
            updatableFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    settings[field] = req.body[field];
                }
            });
            
            await settings.save();
        }
        res.status(200).json({ message: "Settings updated successfully", settings });
    } catch (error) {
        res.status(500).json({ message: "Error updating settings", error: error.message });
    }
};
