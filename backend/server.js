const express = require("express");
const path = require("path");
const env = require("./src/config/env");
const pool = require("./src/config/database");
const logger = require("./src/middleware/logger");
const errorHandler = require("./src/middleware/errorHandler");
const kasirRoutes = require("./src/routes/kasir");
const authRoutes = require("./src/routes/auth");
const profileRoutes = require("./src/routes/profile");
const usersRoutes = require("./src/routes/users");
const categoriesRoutes = require("./src/routes/categories");
const productsRoutes = require("./src/routes/products");
const stocksRoutes = require("./src/routes/stocks");
const transactionsRoutes = require("./src/routes/transactions");
const dashboardRoutes = require("./src/routes/dashboard");
const reportsRoutes = require("./src/routes/reports");
const activityLogsRoutes = require("./src/routes/activityLogs");
const notificationsRoutes = require("./src/routes/notifications");
const settingsRoutes = require("./src/routes/settings");

const app = express();

app.use(express.json());
app.use(logger);

// Phase 1 health probe (no secrets exposed).
app.get("/api/health", async (req, res) => {
    try {
        await pool.testConnection();
        res.json({ success: true, app: "up", db: "up" });
    } catch (err) {
        res.status(503).json({ success: false, app: "up", db: "down", message: "Database tidak terjangkau" });
    }
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/stocks", stocksRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/activity-logs", activityLogsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api", kasirRoutes);
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.use(errorHandler);

app.listen(env.port, async () => {
    console.log(`Server berjalan di http://localhost:${env.port}`);
    try {
        await pool.testConnection();
        console.log(`Database terhubung: ${env.db.database}@${env.db.host}:${env.db.port}`);
    } catch (err) {
        console.error(`Database tidak terjangkau: ${err.message}`);
    }
});
