const crypto = require("crypto");
const db = require("../config/db");
const { trustedOrigins } = require("./origins");

const COOKIE_NAME = "viniyog_session";
const SESSION_HOURS = 12;
const REMEMBER_DAYS = 7;

function createSessionToken() {
    return crypto.randomBytes(32).toString("base64url");
}

function hashSessionToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function sessionMaxAge(rememberMe) {
    return rememberMe
        ? REMEMBER_DAYS * 24 * 60 * 60
        : SESSION_HOURS * 60 * 60;
}

function cookieOptions(maxAge) {
    const configuredSameSite = (process.env.SESSION_COOKIE_SAME_SITE || "Lax").toLowerCase();
    const sameSite = ["lax", "strict", "none"].includes(configuredSameSite)
        ? configuredSameSite[0].toUpperCase() + configuredSameSite.slice(1)
        : "Lax";
    const parts = [
        `${COOKIE_NAME}=`,
        "Path=/",
        "HttpOnly",
        `SameSite=${sameSite}`
    ];

    if (maxAge !== undefined) {
        parts.push(`Max-Age=${maxAge}`);
    } else {
        parts.push("Max-Age=0");
    }

    if (sameSite === "None" || process.env.NODE_ENV === "production" ||
        process.env.SESSION_COOKIE_SECURE === "true") {
        parts.push("Secure");
    }

    return parts.join("; ");
}

function setSessionCookie(res, token, maxAge) {
    const value = cookieOptions(maxAge).replace(`${COOKIE_NAME}=`, `${COOKIE_NAME}=${token}`);
    res.setHeader("Set-Cookie", value);
}

function clearSessionCookie(res) {
    res.setHeader("Set-Cookie", cookieOptions());
}

function readSessionToken(req) {
    const cookieHeader = req.headers.cookie || "";

    for (const part of cookieHeader.split(";")) {
        const separator = part.indexOf("=");
        if (separator < 0 || part.slice(0, separator).trim() !== COOKIE_NAME) {
            continue;
        }

        const token = part.slice(separator + 1).trim();
        return /^[A-Za-z0-9_-]{40,50}$/.test(token) ? token : null;
    }

    return null;
}

async function createStudentSession(studentId, tokenHash, maxAge) {
    const expiresAt = new Date(Date.now() + maxAge * 1000);
    await db.promise().execute(
        `INSERT INTO student_sessions (token_hash, student_id, expires_at)
         VALUES (?, ?, ?)`,
        [tokenHash, studentId, expiresAt]
    );
}

async function findStudentSession(tokenHash) {
    const [rows] = await db.promise().execute(
        `SELECT s.id, s.PRN, s.student_name
         FROM student_sessions ss
         JOIN students s ON s.id = ss.student_id
         WHERE ss.token_hash = ? AND ss.expires_at > CURRENT_TIMESTAMP
         LIMIT 1`,
        [tokenHash]
    );
    return rows[0] || null;
}

async function deleteStudentSession(tokenHash) {
    await db.promise().execute(
        "DELETE FROM student_sessions WHERE token_hash = ?",
        [tokenHash]
    );
}

async function requireAuth(req, res, next) {
    const token = readSessionToken(req);

    if (!token) {
        return res.status(401).json({ message: "Please log in to continue." });
    }

    try {
        const student = await findStudentSession(hashSessionToken(token));
        if (!student) {
            clearSessionCookie(res);
            return res.status(401).json({ message: "Your session has expired. Please log in again." });
        }
        req.student = student;
        req.sessionTokenHash = hashSessionToken(token);
        return next();
    } catch (error) {
        console.error("Session lookup failed:", error.message);
        return res.status(503).json({ message: "Authentication is temporarily unavailable." });
    }
}

function requireTrustedOrigin(req, res, next) {
    const origin = req.get("origin");

    if (origin && !trustedOrigins.has(origin)) {
        return res.status(403).json({ message: "This request origin is not allowed." });
    }

    return next();
}

module.exports = {
    COOKIE_NAME,
    createSessionToken,
    hashSessionToken,
    sessionMaxAge,
    setSessionCookie,
    clearSessionCookie,
    readSessionToken,
    createStudentSession,
    deleteStudentSession,
    requireAuth,
    requireTrustedOrigin
};
