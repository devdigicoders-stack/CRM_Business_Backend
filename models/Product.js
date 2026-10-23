const mongoose = require("mongoose");

const kitComponentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: 'Nos' },
    specification: { type: String, default: '' },
    estimatedPrice: { type: Number, default: 0 }
}, { _id: false });

const productSchema = new mongoose.Schema({
    itemType: { type: String, enum: ['Product', 'Service', 'Kit', 'Installation Package'], default: 'Product' },
    name: { type: String, required: true, trim: true },
    capacity: { type: String, default: '' },       // e.g. "3kW", "5kW", "10kW"
    phase: { type: String, default: '' },          // e.g. "Single Phase", "Three Phase"
    basePrice: { type: Number, default: 0 },       // Cost / Base Price
    price: { type: Number, required: true },        // Selling Price
    gstPercentage: { type: Number, default: 18 },  // GST %
    description: { type: String, default: "" },
    kitComponents: [kitComponentSchema],           // Array of included items if itemType is 'Kit'
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);
