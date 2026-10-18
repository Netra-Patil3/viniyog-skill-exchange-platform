const bcrypt = require("bcrypt");
const fs = require("fs/promises");
const db = require("../config/db");
const signupModel = require("../models/signupModel");
const { validateSignup } = require("../lib/validation");
const { validImageSignature } = require("../lib/profilePhotoUpload");
const { signupFailure } = require("../lib/signupErrors");

async function isEmailAlreadyRegistered(email) {
    try {
        const [rows] = await db.promise().execute(
            "SELECT student_id FROM student_profiles WHERE LOWER(TRIM(email)) = ? LIMIT 1",
            [email]
        );
        return rows.length > 0;
    } catch (error) {
        error.signupOperation = "check email";
        throw error;
    }
}

async function validateUploadedPhoto(file) {
    if (!file) {
        return true;
    }

    const handle = await fs.open(file.path, "r");
    try {
        const header = Buffer.alloc(12);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        return validImageSignature(header.subarray(0, bytesRead), file.mimetype);
    } finally {
        await handle.close();
    }
}

async function registerStudent(req, res) {
    const validation = validateSignup(req.body);
    if (validation.error) {
        return res.status(400).json({ message: validation.error });
    }

    try {
        if (!(await validateUploadedPhoto(req.file))) {
            return res.status(400).json({ message: "The selected file is not a valid JPG, PNG, or WebP image." });
        }

        const { values, teachSkills, learnSkills } = validation;
        if (await isEmailAlreadyRegistered(values.email)) {
            return res.status(409).json({
                message: "An account with this email address already exists. Please log in or use another email."
            });
        }

        const passwordHash = await bcrypt.hash(values.password, 12);

        const student = {
            prn: values.prn,
            studentName: values.fullName,
            department: values.department,
            academicYear: values.academicYear,
            collegeName: values.college,
            profilePhoto: req.file
                ? `assets/profile photos/${req.file.filename}`
                : null
        };

        const profile = {
            bio: values.bio || null,
            linkedin: values.linkedin || null,
            github: values.github || null,
            mobileNumber: values.phone || null,
            whatsappNumber: values.whatsapp || null,
            email: values.email,
            otherContact: values.otherContact || values.portfolio || null
        };

        const studentId = await new Promise((resolve, reject) => {
            signupModel.registerStudent(
                student,
                profile,
                passwordHash,
                teachSkills,
                learnSkills,
                (error, id) => error ? reject(error) : resolve(id)
            );
        });

        return res.status(201).json({
            message: "Account created successfully. Please log in to continue.",
            studentId
        });
    } catch (error) {
        console.error("Signup error:", {
            code: error.code || "unexpected error",
            operation: error.signupOperation || "request validation or photo processing",
            constraint: error.signupConstraint || undefined,
            rollbackFailed: Boolean(error.signupRollbackFailed)
        });
        const failure = signupFailure(error);
        return res.status(failure.status).json({ message: failure.message });
    }
}

module.exports = { registerStudent };
