const TaskTemplate = require("../models/TaskTemplate");

exports.createTaskTemplate = async (req, res) => {
    try {
        const { stepNumber, taskName, department, description, requiredDocuments, tatHours } = req.body;

        const newTemplate = await TaskTemplate.create({
            stepNumber,
            taskName,
            department,
            description,
            requiredDocuments,
            tatHours
        });

        res.status(201).json({ message: "Task Template created successfully", template: newTemplate });
    } catch (error) {
        res.status(500).json({ message: "Failed to create task template", error: error.message });
    }
};

exports.getTaskTemplates = async (req, res) => {
    try {
        const templates = await TaskTemplate.find().sort({ stepNumber: 1 }).populate("department", "name");
        res.status(200).json(templates);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch task templates", error: error.message });
    }
};

exports.updateTaskTemplate = async (req, res) => {
    try {
        const updated = await TaskTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ message: "Template not found" });
        res.status(200).json({ message: "Updated successfully", template: updated });
    } catch (error) {
        res.status(500).json({ message: "Failed to update template", error: error.message });
    }
};

exports.deleteTaskTemplate = async (req, res) => {
    try {
        await TaskTemplate.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Template deleted" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete template", error: error.message });
    }
};
