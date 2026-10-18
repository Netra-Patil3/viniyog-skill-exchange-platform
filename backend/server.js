const express = require("express");
const cors = require("cors");
const studentRoutes = require("./routes/studentRoutes");
const signupRoutes = require("./routes/signupRoutes");
const loginRoutes = require("./routes/loginRoutes");
const authRoutes = require("./routes/authRoutes");
const notesRoutes = require("./routes/notesRoutes");
const exchangeRequestRoutes = require("./routes/exchangeRequestRoutes");
const path = require("path");
const { trustedOrigins } = require("./lib/origins");
const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors({
    origin(origin, callback) {
        if (!origin || trustedOrigins.has(origin)) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true
}));

// Middleware
app.use(express.json({ limit: "32kb" }));

// Routes
app.use("/api", studentRoutes);
app.use("/api", signupRoutes);
app.use("/api", loginRoutes);
app.use("/api", authRoutes);
app.use("/api", notesRoutes);
app.use("/api", exchangeRequestRoutes);
app.get("/", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../frontend/index.html"));
});

app.use(express.static(path.resolve(__dirname, "../frontend"), {
    dotfiles: "deny",
    index: false
}));

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }
    if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "Uploaded file exceeds the allowed size." });
    }
    if (error.name === "MulterError" ||
        error.message === "Only JPG, PNG, and WEBP images are allowed." ||
        error.message === "Only PDF and plain-text notes are allowed.") {
        return res.status(400).json({ message: error.message });
    }
    console.error("Unhandled request error:", error.message);
    return res.status(500).json({ message: "An unexpected server error occurred." });
});

app.listen(PORT, () => {
    console.log(`Viniyog backend running on port ${PORT}`);
});