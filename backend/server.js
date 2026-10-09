const express = require("express");
const cors = require("cors");
const db = require("./config/db");
const studentRoutes = require("./routes/studentRoutes");

const app = express();
app.use(cors());
const PORT = 5000;

// Middleware
app.use(express.json());

// Routes
app.use("/api", studentRoutes);

app.get("/", (req, res) => {
    res.send("Viniyog Backend is Working!");
});

app.listen(PORT, () => {
    console.log(`Viniyog backend running on port ${PORT}`);
});