const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db"); // DB Connection File Import
const seedSuperAdmin = require("./scripts/seedAdmin"); // Seed Script Import
require("dotenv").config();

// Connect to Database
connectDB().then(() => {
    // Run seed script automatically after DB connects
    seedSuperAdmin();
});

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Serve uploads folder statically so frontend can access images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Import Routes
const authRoutes = require("./routes/authRoutes");
const roleRoutes = require("./routes/roleRoutes");
const masterRoutes = require("./routes/masterRoutes");
const salesRoutes = require("./routes/salesRoutes");
const operationRoutes = require("./routes/operationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const incentiveRoutes = require("./routes/incentiveRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const { checkTATBreaches } = require("./cron/tatCronJobs");

// Use Routes
app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/master", masterRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/operations", operationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/incentives", incentiveRoutes);
app.use("/api/expenses", expenseRoutes);

// Start TAT Cron Jobs
checkTATBreaches();

app.get("/", (req, res) => {
    res.send("MERN CRM Backend Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});