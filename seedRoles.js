const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Role = require('./models/Role');

// Load env vars
dotenv.config();

// ============================================================
// PERMISSIONS are named EXACTLY as used in routes via authorizePermission()
// salesRoutes.js uses: create_lead, view_leads, manage_leads, 
//                      verify_documents, create_quotation, view_quotations,
//                      manage_quotations, convert_lead
// operationRoutes.js uses: create_project, view_projects, manage_project_workflow,
//                           create_task, add_task_remark
// ============================================================

const rolesData = [
  {
    name: "Admin",
    permissions: [
      // Leads
      "create_lead", "view_leads", "manage_leads", "convert_lead", "verify_documents", "upload_documents", "bulk_upload_leads",
      // Quotations
      "create_quotation", "view_quotations", "manage_quotations",
      // Operations
      "create_project", "view_projects", "manage_project_workflow",
      "create_task", "add_task_remark", "view_calendar",
      // Users & Settings
      "create_employees", "manage_employees", "create_managers",
      "assign_managers", "manage_products", "manage_settings",
      "monitor_activities", "view_reports", "receive_tat_notifications"
    ]
  },
  {
    name: "Operation Head",
    permissions: [
      // Can view approved leads and docs
      "view_leads", "verify_documents",
      // Project & Task Management
      "create_project", "view_projects", "manage_project_workflow",
      "create_task", "add_task_remark",
      // Payment tracking
      "view_quotations", "view_calendar"
    ]
  },
  {
    name: "Sales Manager",
    permissions: [
      // Lead management for self + team
      "create_lead", "view_leads", "manage_leads", "verify_documents", "upload_documents", "bulk_upload_leads",
      // Quotations
      "create_quotation", "view_quotations", "manage_quotations",
      // Can view tasks but not create
      "view_projects", "view_calendar"
    ]
  },
  {
    name: "Sales Executive",
    permissions: [
      // Can create leads, view own
      "create_lead", "view_leads",
      // Quotations - create & share
      "create_quotation", "view_quotations",
      // Can upload docs
      "upload_documents", "view_calendar"
    ]
  },
  {
    name: "Computer Operator",
    permissions: ["execute_operator_tasks", "view_projects"]
  },
  {
    name: "Registration Team",
    permissions: ["execute_registration_tasks", "view_projects"]
  },
  {
    name: "Bank Coordinator",
    permissions: ["execute_bank_tasks", "view_projects"]
  },
  {
    name: "Installation Team",
    permissions: ["execute_installation_tasks", "view_projects"]
  },
  {
    name: "Other Staff",
    permissions: ["execute_general_tasks", "view_projects"]
  }
];

const seedRoles = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB for seeding Roles...\n");

        for (const roleData of rolesData) {
            // Upsert: update if exists, create if not
            const updated = await Role.findOneAndUpdate(
                { name: roleData.name },
                { $set: { permissions: roleData.permissions } },
                { upsert: true, new: true }
            );
            console.log(`✅ Role Seeded: "${updated.name}" (${updated.permissions.length} permissions)`);
        }

        console.log("\n🎉 All Roles seeded successfully! Permissions are now LIVE and enforced.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding roles:", error);
        process.exit(1);
    }
};

seedRoles();
