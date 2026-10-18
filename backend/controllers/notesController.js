const fs = require("fs/promises");
const path = require("path");
const notesModel = require("../models/notesModel");

const uploadDirectory = path.resolve(
    process.env.NOTES_UPLOAD_DIR || path.join(__dirname, "../uploads/notes")
);

function validNoteContent(buffer, mimetype) {
    if (mimetype === "application/pdf") {
        return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    }
    if (mimetype === "text/plain") {
        try {
            new TextDecoder("utf-8", { fatal: true }).decode(buffer);
            return !buffer.includes(0);
        } catch {
            return false;
        }
    }
    return false;
}

async function createNote(req, res) {
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    if (!title || title.length > 150) {
        return res.status(400).json({ message: "Enter a note title of 1 to 150 characters." });
    }
    if (!req.file) {
        return res.status(400).json({ message: "Select a PDF or plain-text note to upload." });
    }

    try {
        const fileContent = await fs.readFile(req.file.path);
        if (!validNoteContent(fileContent, req.file.mimetype)) {
            await fs.unlink(req.file.path);
            return res.status(400).json({ message: "The uploaded file content does not match a supported PDF or text file." });
        }

        const originalName = path.basename(req.file.originalname.replace(/\\/g, "/"))
            .replace(/[^A-Za-z0-9._ -]/g, "_")
            .slice(0, 255) || "note";

        await new Promise((resolve, reject) => {
            notesModel.createNote(
                req.student.id,
                title,
                originalName,
                path.basename(req.file.filename),
                (error, result) => error ? reject(error) : resolve(result)
            );
        });

        return res.status(201).json({ message: "Note uploaded successfully." });
    } catch (error) {
        console.error("Note upload failed:", error.message);
        try {
            await fs.unlink(req.file.path);
        } catch (cleanupError) {
            if (cleanupError.code !== "ENOENT") {
                console.error("Failed to clean up note upload:", cleanupError.message);
            }
        }
        return res.status(500).json({ message: "Unable to save the note. Please try again." });
    }
}

function getNotes(req, res) {
    notesModel.getAllNotes((error, results) => {
        if (error) {
            console.error("Note list query failed:", error.message);
            return res.status(500).json({ message: "Unable to load shared notes." });
        }
        return res.status(200).json(results);
    });
}

function downloadNote(req, res) {
    const noteId = /^[1-9]\d*$/.test(req.params.id)
        ? Number(req.params.id)
        : NaN;
    if (!Number.isSafeInteger(noteId)) {
        return res.status(400).json({ message: "Invalid note ID." });
    }

    notesModel.getNoteById(noteId, (error, rows) => {
        if (error) {
            console.error("Note download lookup failed:", error.message);
            return res.status(500).json({ message: "Unable to download the note." });
        }
        if (!rows.length) {
            return res.status(404).json({ message: "Note not found." });
        }

        const note = rows[0];
        if (!/^[0-9a-f-]{36}\.(pdf|txt)$/.test(note.file_path)) {
            return res.status(404).json({ message: "Note file is unavailable." });
        }

        const filePath = path.resolve(uploadDirectory, note.file_path);
        if (path.dirname(filePath) !== uploadDirectory) {
            return res.status(404).json({ message: "Note file is unavailable." });
        }

        return res.download(filePath, note.file_name, (downloadError) => {
            if (downloadError && !res.headersSent) {
                if (downloadError.code === "ENOENT") {
                    return res.status(404).json({ message: "Note file is unavailable." });
                }
                console.error("Note file download failed:", downloadError.message);
                return res.status(500).json({ message: "Unable to download the note." });
            }
        });
    });
}

function getStudentNotes(req, res) {
    const studentId = Number(req.params.studentId);

    if (!Number.isSafeInteger(studentId) || studentId <= 0) {
        return res.status(400).json({
            message: "Invalid student ID."
        });
    }

    notesModel.getNotesByStudentId(studentId, (error, results) => {
        if (error) {
            console.error("Student notes query failed:", error.message);

            return res.status(500).json({
                message: "Unable to load this student's notes."
            });
        }

        return res.status(200).json(results);
    });
}

module.exports = { uploadDirectory, createNote, getNotes, downloadNote,getStudentNotes };
