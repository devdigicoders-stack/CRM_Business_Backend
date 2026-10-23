const Product = require("../models/Product");

// Create Product (Admin / with manage_products permission)
exports.createProduct = async (req, res) => {
    try {
        const { name, price, basePrice, description, itemType, gstPercentage, capacity, phase, kitComponents } = req.body;
        if (!name || price === undefined || price === null || price === '') {
            return res.status(400).json({ message: "Name and price are required" });
        }
        const product = await Product.create({ 
            name, 
            price: Number(price), 
            basePrice: basePrice ? Number(basePrice) : 0, 
            description, 
            itemType: itemType || 'Product', 
            gstPercentage: gstPercentage !== undefined ? Number(gstPercentage) : 18,
            capacity: capacity || '',
            phase: phase || '',
            kitComponents: Array.isArray(kitComponents) ? kitComponents : []
        });
        res.status(201).json({ message: "Product created successfully", product });
    } catch (error) {
        res.status(500).json({ message: "Error creating product", error: error.message });
    }
};

// Get All Products
exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true }).sort({ name: 1 });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: "Error fetching products", error: error.message });
    }
};

// Update Product
exports.updateProduct = async (req, res) => {
    try {
        const { name, price, basePrice, description, itemType, gstPercentage, capacity, phase, kitComponents } = req.body;
        const updateData = { 
            name, 
            price: Number(price), 
            basePrice: basePrice ? Number(basePrice) : 0, 
            description, 
            itemType: itemType || 'Product', 
            gstPercentage: gstPercentage !== undefined ? Number(gstPercentage) : 18,
            capacity: capacity || '',
            phase: phase || ''
        };
        if (kitComponents !== undefined) {
            updateData.kitComponents = Array.isArray(kitComponents) ? kitComponents : [];
        }
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.status(200).json({ message: "Product updated", product });
    } catch (error) {
        res.status(500).json({ message: "Error updating product", error: error.message });
    }
};

// Delete Product
exports.deleteProduct = async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting product", error: error.message });
    }
};
