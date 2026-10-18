
const express = require("express");
const fs = require("fs");

const signupController = require("../controllers/signupController");
const { requireTrustedOrigin } = require("../lib/session");
const { uploadProfilePhoto } = require("../lib/profilePhotoUpload");

const router = express.Router();

router.post("/signup", requireTrustedOrigin, uploadProfilePhoto.single("profilePhoto"), async (req, res, next) => {
    res.on("finish", () => {
        if (res.statusCode >= 400 && req.file) {
            fs.unlink(req.file.path, (error) => {
                if (error && error.code !== "ENOENT") {
                    console.error("Profile photo cleanup failed:", error.message);
                }
            });
        }
    });

    try {
        await signupController.registerStudent(req, res);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
