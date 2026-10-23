const Department = require("../models/Department");
const DocumentType = require("../models/DocumentType");

// ======================= DEPARTMENTS =======================
exports.createDepartment = async (req, res) => {
    try {
        const { name, departmentCode, description, headOfDepartment, contactEmail, contactPhone, isActive } = req.body;
        const department = await Department.create({
            name, departmentCode, description, headOfDepartment, contactEmail, contactPhone, isActive
        });
        res.status(201).json({ message: "Department created", department });
    } catch (error) { res.status(500).json({ message: "Error", error: error.message }); }
};

exports.getDepartments = async (req, res) => {
    try {
        const departments = await Department.find().populate("headOfDepartment", "name email");
        res.status(200).json(departments);
    } catch (error) { res.status(500).json({ message: "Error", error: error.message }); }
};

exports.updateDepartment = async (req, res) => {
    try {
        const { name, departmentCode, description, headOfDepartment, contactEmail, contactPhone, isActive } = req.body;
        const department = await Department.findByIdAndUpdate(
            req.params.id, 
            { name, departmentCode, description, headOfDepartment, contactEmail, contactPhone, isActive }, 
            { new: true }
        );
        res.status(200).json({ message: "Department updated", department });
    } catch (error) { res.status(500).json({ message: "Error", error: error.message }); }
};

exports.deleteDepartment = async (req, res) => {
    try {
        await Department.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Department deleted" });
    } catch (error) { res.status(500).json({ message: "Error", error: error.message }); }
};

// ======================= DOCUMENT TYPES =======================
exports.createDocumentType = async (req, res) => {
    try {
        const docType = await DocumentType.create({ name: req.body.name, isRequired: req.body.isRequired || false });
        res.status(201).json({ message: "Document type created", docType });
    } catch (error) { res.status(500).json({ message: "Error", error: error.message }); }
};

exports.getDocumentTypes = async (req, res) => {
    try {
        const docTypes = await DocumentType.find({ isActive: true });
        res.status(200).json(docTypes);
    } catch (error) { res.status(500).json({ message: "Error", error: error.message }); }
};

exports.updateDocumentType = async (req, res) => {
    try {
        const { isRequired } = req.body;
        const docType = await DocumentType.findByIdAndUpdate(
            req.params.id, 
            { isRequired }, 
            { new: true }
        );
        res.status(200).json({ message: "Document type updated", docType });
    } catch (error) { res.status(500).json({ message: "Error", error: error.message }); }
};

exports.deleteDocumentType = async (req, res) => {
    try {
        await DocumentType.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Document type deleted" });
    } catch (error) { res.status(500).json({ message: "Error", error: error.message }); }
};
