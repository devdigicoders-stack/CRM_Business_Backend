const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    itemType: { type: String, enum: ['Product', 'Service'], default: 'Product' },
    name: { type: String, required: true, trim: true },
    basePrice: { type: Number, default: 0 },   // Cost / Base Price
    price: { type: Number, required: true },    // Selling Price
    gstPercentage: { type: Number, default: 18 }, // GST % for this specific item
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);
