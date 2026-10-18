const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const controller = require("../controllers/notesController");
const { requireAuth, requireTrustedOrigin } = require("../lib/session");

const router = express.Router();
fs.mkdirSync(controller.uploadDirectory, { recursive: true });

const allowed = {
    ".pdf": "application/pdf",
    ".txt": "text/plain"
};

const upload = multer({
    storage: multer.diskStorage({
        destination: controller.uploadDirectory,
        filename: (req, file, callback) => {
            const extension = path.extname(file.originalname).toLowerCase();
            callback(null, `${crypto.randomUUID()}${extension}`);
        }
    }),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
        fields: 1,
        fieldSize: 600,
        parts: 2
    },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        if (allowed[extension] !== file.mimetype) {
            return callback(new Error("Only PDF and plain-text notes are allowed."));
        }
        return callback(null, true);
    }
});

router.get("/notes", requireAuth, controller.getNotes);
router.post(
    "/notes",
    requireTrustedOrigin,
    requireAuth,
    upload.single("noteFile"),
    controller.createNote
);
router.get("/notes/:id/download", requireAuth, controller.downloadNote);

router.get(
    "/students/:studentId/notes",
    requireAuth,
    controller.getStudentNotes
);

module.exports = router;
