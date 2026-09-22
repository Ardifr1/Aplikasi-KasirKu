const express = require("express");
const path = require("path");
const config = require("./src/config/database");
const logger = require("./src/middleware/logger");
const kasirRoutes = require("./src/routes/kasir");

const app = express();

app.use(express.json());
app.use(logger);

app.use("/api", kasirRoutes);
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.listen(config.port, () => {
    console.log(`Server berjalan di http://localhost:${config.port}`);
});
