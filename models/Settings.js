const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
    companyName: { type: String, default: "DigiCoders Technologies" },
    companyEmail: { type: String },
    companyPhone: { type: String },
    companyAddress: { type: String },
    companyLogo: { type: String }, // Path for logo upload
    currency: { type: String, default: "INR" },
    leadApprovalTAT: { type: Number, default: 24 }, // In Hours

    // Quotation Dynamic Branding & Template
    companySlogan: { type: String, default: "BUILD | INNOVATE | GROW" },
    quotationSubtitle: { type: String, default: "Software Solutions for a Better Tomorrow" },
    defaultDesignation: { type: String, default: "Sales Executive" },
    
    // Terms & Conditions (Editable array of points)
    termsAndConditions: { 
        type: [String], 
        default: [
            "This quotation is valid for 30 days from the date of issue.",
            "50% advance payment required to initiate the work.",
            "Balance payment after project completion.",
            "Any additional features will be charged separately.",
            "Project timeline: 2 – 4 weeks (depending on requirements).",
            "Includes 3 months free support after delivery.",
            "GST (18%) is applicable as per government rules."
        ] 
    },

    // Why Choose Us Highlights
    whyChooseUs: {
        type: [String],
        default: [
            "Experienced Development Team",
            "Modern & Secure Technology Stack",
            "On-Time Delivery",
            "Dedicated Support & Maintenance"
        ]
    },

    // Signatory & Stamp
    signatoryName: { type: String, default: "Amit Kumar" },
    signatoryDesignation: { type: String, default: "Director" },
    signatoryCompany: { type: String, default: "DigiCoders Technologies" },
    stampCity: { type: String, default: "LUCKNOW" },
    digitalSignature: { type: String, default: "" }, // Base64 or Image URL for actual signature
    companyStamp: { type: String, default: "" }, // Base64 or Image URL for official rubber stamp seal

    // Thank you note
    thankYouNote: { 
        type: String, 
        default: "We appreciate the opportunity to work with you. Looking forward to a long-term business relationship." 
    },

    // Social Media Links & Website
    websiteUrl: { type: String, default: "https://www.digicoders.com" },
    linkedinUrl: { type: String, default: "https://www.linkedin.com/company/digicoders-technologies" },
    instagramUrl: { type: String, default: "https://www.instagram.com/digicoders" },
    facebookUrl: { type: String, default: "https://www.facebook.com/digicoders" },
    youtubeUrl: { type: String, default: "https://www.youtube.com/@digicoders" }
}, { timestamps: true });

module.exports = mongoose.model("Settings", settingsSchema);
