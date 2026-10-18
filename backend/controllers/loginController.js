
const loginModel = require("../models/loginModel");
const studentModel = require("../models/studentModel");
const { findStudentForPassword } = require("../lib/passwordAuthentication");
const {
    createSessionToken,
    hashSessionToken,
    sessionMaxAge,
    setSessionCookie,
    createStudentSession,
    deleteStudentSession,
    readSessionToken,
    clearSessionCookie
} = require("../lib/session");

async function loginStudent(req, res) {
    const body = req.body || {};
    const identifier = typeof body.identifier === "string"
        ? body.identifier.trim()
        : typeof body.prn === "string"
            ? body.prn.trim()
            : typeof body.email === "string"
                ? body.email.trim()
                : "";
    const password = body.password;

    if (!identifier || identifier.length > 255 ||
        typeof password !== "string" || !password ||
        Buffer.byteLength(password, "utf8") > 72) {
        return res.status(400).json({ message: "Please enter your PRN or email and password." });
    }

    try {
        const results = await new Promise((resolve, reject) => {
            loginModel.getStudentByIdentifier(identifier, (error, rows) =>
                error ? reject(error) : resolve(rows)
            );
        });

        if (!results.length) {
            return res.status(401).json({ message: "Invalid PRN/email or password." });
        }

        const student = await findStudentForPassword(results, password);
        if (!student) {
            return res.status(401).json({ message: "Invalid PRN/email or password." });
        }

        const rememberMe = body.remember === true || body.remember === "on";
        const maxAge = sessionMaxAge(rememberMe);
        const token = createSessionToken();
        await createStudentSession(student.id, hashSessionToken(token), maxAge);
        setSessionCookie(res, token, maxAge);

        return res.status(200).json({
            message: "Login successful.",
            student: {
                id: student.id,
                name: student.student_name
            }
        });
    } catch (error) {
        if (error.code === "ER_NO_SUCH_TABLE") {
            return res.status(503).json({
                message: "Authentication storage is not initialized. Apply backend/database/migrations/001_v1_features.sql and try again."
            });
        }
        console.error("Login failed:", error.code || "database or session error");
        return res.status(503).json({ message: "Unable to log in right now. Please try again." });
    }
}

function getCurrentStudent(req, res) {
    studentModel.getMyProfile(req.student.id, (error, rows) => {
        if (error) {
            console.error("Current student profile query failed:", error.message);
            return res.status(500).json({ message: "Unable to load your account." });
        }
        if (!rows.length) {
            return res.status(404).json({ message: "Student account not found." });
        }
        return res.status(200).json(rows[0]);
    });
}

async function logoutStudent(req, res) {
    const token = readSessionToken(req);
    if (token) {
        try {
            await deleteStudentSession(hashSessionToken(token));
        } catch (error) {
            console.error("Logout session deletion failed:", error.message);
            return res.status(503).json({ message: "Unable to log out right now. Please try again." });
        }
    }
    clearSessionCookie(res);
    return res.status(200).json({ message: "Logged out successfully." });
}

module.exports = {
    loginStudent,
    getCurrentStudent,
    logoutStudent
};
