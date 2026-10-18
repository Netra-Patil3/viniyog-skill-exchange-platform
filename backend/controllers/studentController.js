
const studentModel = require("../models/studentModel");
const fs = require("fs/promises");
const { validateProfileUpdate } = require("../lib/validation");
const { validImageSignature } = require("../lib/profilePhotoUpload");
const { clearSessionCookie } = require("../lib/session");

const getStudents = (req, res) => {
    studentModel.getAllStudents((err, results) => {
        if (err) {
            console.error("Error fetching students:", err.message);

            return res.status(500).json({
                message: "Failed to fetch students"
            });
        }

        res.status(200).json(results);
    });
};

const getStudentById = (req, res) => {
    const studentId = /^[1-9]\d*$/.test(req.params.id)
        ? Number(req.params.id)
        : NaN;

    if (!Number.isSafeInteger(studentId)) {
        return res.status(400).json({
            message: "Invalid student ID"
        });
    }

    studentModel.getStudentById(studentId, (err, results) => {
        if (err) {
            console.error("Error fetching student profile:", err.message);

            return res.status(500).json({
                message: "Failed to fetch student profile"
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                message: "Student not found"
            });
        }

        res.status(200).json(results[0]);
    });
};


const getFilterOptions = (req, res) => {
    studentModel.getFilterOptions((err, results) => {
        if (err) {
            console.error("Error fetching filter options:", err.message);

            return res.status(500).json({
                message: "Failed to fetch filter options"
            });
        }

        const options = results[0] || {};

        res.status(200).json({
            departments: options.departments || [],
            academic_years: options.academic_years || [],
            colleges: options.colleges || [],
            skills: options.skills || []
        });
    });
};

const deleteMyAccount = async (req, res) => {
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!password || Buffer.byteLength(password, "utf8") > 72) {
        return res.status(400).json({ message: "Enter your current password to delete your account." });
    }

    try {
        const deleted = await studentModel.deleteMyAccount(req.student.id, password);
        if (!deleted) {
            return res.status(401).json({
                message: "The password you entered is incorrect. Your account was not deleted."
            });
        }

        clearSessionCookie(res);
        return res.status(200).json({ message: "Your account has been deleted successfully." });
    } catch (error) {
        console.error("Delete account failed:", error.message);
        return res.status(500).json({ message: "Unable to delete your account right now. Please try again." });
    }
};

const updateMyProfile = async (req, res) => {
    const removalValue = req.body?.removeProfilePhoto;
    if (removalValue !== undefined && removalValue !== "true" && removalValue !== "false") {
        if (req.file) {
            await fs.unlink(req.file.path).catch((error) => {
                if (error.code !== "ENOENT") {
                    console.error("Invalid profile photo cleanup failed:", error.message);
                }
            });
        }
        return res.status(400).json({ message: "Invalid profile photo removal request." });
    }
    const removeProfilePhoto = removalValue === "true";
    if (removeProfilePhoto && req.file) {
        await fs.unlink(req.file.path).catch((error) => {
            if (error.code !== "ENOENT") {
                console.error("Unselected profile photo cleanup failed:", error.message);
            }
        });
        return res.status(400).json({ message: "Choose either a replacement photo or photo removal, not both." });
    }

    const validation = validateProfileUpdate(req.body || {});
    if (validation.error) {
        if (req.file) {
            await fs.unlink(req.file.path).catch((error) => {
                if (error.code !== "ENOENT") {
                    console.error("Invalid profile photo cleanup failed:", error.message);
                }
            });
        }
        return res.status(400).json({ message: validation.error });
    }
    if (!Object.keys(validation.updates).length && !req.file && !removeProfilePhoto) {
        return res.status(400).json({ message: "Submit at least one profile field to update." });
    }

    if (req.file) {
        try {
            const handle = await fs.open(req.file.path, "r");
            let valid;
            try {
                const header = Buffer.alloc(12);
                const { bytesRead } = await handle.read(header, 0, header.length, 0);
                valid = validImageSignature(header.subarray(0, bytesRead), req.file.mimetype);
            } finally {
                await handle.close();
            }
            if (!valid) {
                await fs.unlink(req.file.path);
                return res.status(400).json({
                    message: "The selected file is not a valid JPG, PNG, or WebP image."
                });
            }
        } catch (error) {
            console.error("Profile photo validation failed:", error.message);
            await fs.unlink(req.file.path).catch((cleanupError) => {
                if (cleanupError.code !== "ENOENT") {
                    console.error("Profile photo cleanup failed:", cleanupError.message);
                }
            });
            return res.status(500).json({ message: "Unable to validate the profile photo." });
        }
    }

    const photoPath = req.file
        ? `assets/profile photos/${req.file.filename}`
        : null;
    try {
        const updateResult = await studentModel.updateMyProfile(
            req.student.id,
            photoPath,
            removeProfilePhoto,
            validation.updates
        );
        return res.status(200).json({
            message: updateResult.photoCleanupFailed
                ? "Profile updated successfully, but the previous photo could not be removed automatically."
                : "Profile updated successfully."
        });
    } catch (error) {
        console.error("Profile update failed:", error.code || "database error");
        if (req.file) {
            await fs.unlink(req.file.path).catch((cleanupError) => {
                if (cleanupError.code !== "ENOENT") {
                    console.error("Profile photo cleanup failed:", cleanupError.message);
                }
            });
        }
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "That email address is already registered to another account."
            });
        }
        return res.status(500).json({ message: "Unable to update your profile." });
    }
};


module.exports = {
    getStudents,
    getStudentById,
    getFilterOptions,
    deleteMyAccount,
    updateMyProfile
};
