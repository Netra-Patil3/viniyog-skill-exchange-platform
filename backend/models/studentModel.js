
const bcrypt = require("bcrypt");
const fs = require("fs/promises");
const path = require("path");
const db = require("../config/db");
const { profilePhotoDirectory } = require("../lib/profilePhotoUpload");

async function saveSkills(connection, tableName, studentId, skillNames) {
    for (const skillName of skillNames) {
        await connection.execute(
            "INSERT IGNORE INTO skills (skill_name) VALUES (?)",
            [skillName]
        );
    }

    await connection.execute(
        `DELETE FROM ${tableName} WHERE student_id = ?`,
        [studentId]
    );
    if (!skillNames.length) {
        return;
    }

    const placeholders = skillNames.map(() => "?").join(", ");
    const [rows] = await connection.execute(
        `SELECT id, skill_name FROM skills
         WHERE LOWER(skill_name) IN (${placeholders})`,
        skillNames.map((skillName) => skillName.toLowerCase())
    );
    const skillIds = new Map(rows.map((row) => [row.skill_name.toLowerCase(), row.id]));
    const links = skillNames.map((skillName) => {
        const skillId = skillIds.get(skillName.toLowerCase());
        if (!skillId) {
            throw new Error("Unable to find or create all requested skills.");
        }
        return [studentId, skillId];
    });
    const values = links.map(() => "(?, ?)").join(", ");
    await connection.execute(
        `INSERT INTO ${tableName} (student_id, skill_id) VALUES ${values}`,
        links.flat()
    );
}

function resolveSafeFilePath(baseDirectory, candidatePath) {
    if (!candidatePath || typeof candidatePath !== "string") {
        return null;
    }

    const normalized = candidatePath.replace(/\\/g, "/");
    const resolved = path.resolve(baseDirectory, normalized);
    const basePath = path.resolve(baseDirectory);

    if (resolved === basePath || resolved.startsWith(`${basePath}${path.sep}`)) {
        return resolved;
    }

    return null;
}

async function cleanupStudentFiles(filePaths) {
    for (const filePath of [...new Set(filePaths.filter(Boolean))]) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            if (error.code !== "ENOENT") {
                console.error("Failed to clean up student-owned file:", error.message);
            }
        }
    }
}

function managedProfilePhotoPath(profilePhoto) {
    const prefix = "assets/profile photos/";
    if (typeof profilePhoto !== "string" || !profilePhoto.startsWith(prefix)) {
        return null;
    }

    const filename = profilePhoto.slice(prefix.length);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(filename)) {
        return null;
    }

    return filename;
}

async function cleanupUnreferencedProfilePhoto(profilePhoto) {
    const filename = managedProfilePhotoPath(profilePhoto);
    if (!filename) {
        return false;
    }

    const [references] = await db.promise().execute(
        "SELECT COUNT(*) AS reference_count FROM students WHERE profile_photo = ?",
        [profilePhoto]
    );
    if (references[0].reference_count > 0) {
        return false;
    }

    const photoDirectory = path.resolve(profilePhotoDirectory);
    const filePath = path.resolve(photoDirectory, filename);
    if (path.dirname(filePath) !== photoDirectory) {
        return false;
    }

    try {
        const fileStat = await fs.lstat(filePath);
        if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
            return false;
        }

        const [realDirectory, realFile] = await Promise.all([
            fs.realpath(photoDirectory),
            fs.realpath(filePath)
        ]);
        const relativeFile = path.relative(realDirectory, realFile);
        if (!relativeFile || relativeFile.startsWith("..") || path.isAbsolute(relativeFile)) {
            return false;
        }

        await fs.unlink(realFile);
        return true;
    } catch (error) {
        if (error.code === "ENOENT") {
            return false;
        }
        throw error;
    }
}

async function deleteMyAccount(studentId, password) {
    const connection = await db.promise().getConnection();
    const profilePhotoRoot = path.resolve(__dirname, "../../frontend");
    const notesDirectory = path.resolve(__dirname, "../uploads/notes");

    try {
        await connection.beginTransaction();
        const [authRows] = await connection.execute(
            "SELECT password_hash FROM student_auth WHERE student_id = ? LIMIT 1",
            [studentId]
        );

        if (!authRows.length) {
            throw new Error("Student account not found.");
        }

        const passwordMatches = await bcrypt.compare(password, authRows[0].password_hash);
        if (!passwordMatches) {
            await connection.rollback();
            return false;
        }

        const [studentRows] = await connection.execute(
            "SELECT profile_photo FROM students WHERE id = ? LIMIT 1",
            [studentId]
        );

        const profilePhoto = studentRows[0]?.profile_photo || null;
        const [noteRows] = await connection.execute(
            "SELECT file_path FROM notes WHERE student_id = ?",
            [studentId]
        );

        const cleanupPaths = [];
        if (profilePhoto && profilePhoto.startsWith("assets/profile photos/")) {
            const resolvedProfilePhoto = resolveSafeFilePath(profilePhotoRoot, profilePhoto);
            if (resolvedProfilePhoto && !resolvedProfilePhoto.endsWith("/Default.jpg") && !resolvedProfilePhoto.endsWith("Default.jpg")) {
                cleanupPaths.push(resolvedProfilePhoto);
            }
        }

        for (const note of noteRows) {
            const noteFilePath = note.file_path;
            if (!noteFilePath || typeof noteFilePath !== "string") {
                continue;
            }

            const resolvedNotePath = resolveSafeFilePath(notesDirectory, noteFilePath);
            if (resolvedNotePath) {
                cleanupPaths.push(resolvedNotePath);
            }
        }

        await connection.execute(
            "DELETE FROM student_sessions WHERE student_id = ?",
            [studentId]
        );
        await connection.execute(
            "DELETE FROM skill_exchange_requests WHERE requester_student_id = ? OR recipient_student_id = ?",
            [studentId, studentId]
        );
        await connection.execute(
            "DELETE FROM student_teach_skills WHERE student_id = ?",
            [studentId]
        );
        await connection.execute(
            "DELETE FROM student_learn_skills WHERE student_id = ?",
            [studentId]
        );
        await connection.execute(
            "DELETE FROM notes WHERE student_id = ?",
            [studentId]
        );
        await connection.execute(
            "DELETE FROM student_profiles WHERE student_id = ?",
            [studentId]
        );
        await connection.execute(
            "DELETE FROM student_auth WHERE student_id = ?",
            [studentId]
        );
        await connection.execute(
            "DELETE FROM students WHERE id = ?",
            [studentId]
        );

        await connection.commit();
        await cleanupStudentFiles(cleanupPaths);
        return true;
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error("Delete account rollback failed:", rollbackError.message);
        }
        throw error;
    } finally {
        connection.release();
    }
}

async function updateMyProfile(studentId, profilePhoto, removeProfilePhoto, updates) {
    const connection = await db.promise().getConnection();
    let oldProfilePhoto = null;
    try {
        await connection.beginTransaction();
        const [studentRows] = await connection.execute(
            "SELECT profile_photo FROM students WHERE id = ? FOR UPDATE",
            [studentId]
        );
        if (!studentRows.length) {
            throw new Error("Student account not found.");
        }

        oldProfilePhoto = studentRows[0].profile_photo;
        if (profilePhoto || removeProfilePhoto) {
            await connection.execute(
                "UPDATE students SET profile_photo = ? WHERE id = ?",
                [profilePhoto || null, studentId]
            );
        }

        const profileColumns = {
            bio: "bio",
            email: "email",
            mobileNumber: "mobile_number"
        };
        const profileEntries = Object.entries(profileColumns)
            .filter(([key]) => Object.hasOwn(updates, key));
        if (profileEntries.length) {
            const columns = profileEntries.map(([, column]) => column);
            const values = profileEntries.map(([key]) => updates[key]);
            const insertColumns = ["student_id", ...columns];
            const insertValues = ["?", ...columns.map(() => "?")];
            const assignments = columns.map((column) => `${column} = VALUES(${column})`);
            await connection.execute(
                `INSERT INTO student_profiles (${insertColumns.join(", ")})
                 VALUES (${insertValues.join(", ")})
                 ON DUPLICATE KEY UPDATE ${assignments.join(", ")}`,
                [studentId, ...values]
            );
        }

        if (Object.hasOwn(updates, "teachSkills")) {
            await saveSkills(connection, "student_teach_skills", studentId, updates.teachSkills);
        }
        if (Object.hasOwn(updates, "learnSkills")) {
            await saveSkills(connection, "student_learn_skills", studentId, updates.learnSkills);
        }
        await connection.commit();
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error("Profile update rollback failed:", rollbackError.message);
        }
        throw error;
    } finally {
        connection.release();
    }

    if (oldProfilePhoto && oldProfilePhoto !== profilePhoto && (profilePhoto || removeProfilePhoto)) {
        try {
            await cleanupUnreferencedProfilePhoto(oldProfilePhoto);
        } catch (error) {
            console.error("Old profile photo cleanup failed:", error.message);
            return { photoCleanupFailed: true };
        }
    }
    return { photoCleanupFailed: false };
}

const getAllStudents = (callback) => {
    const sql = `
        SELECT
            s.id,
            s.student_name,
            s.department,
            s.academic_year,
            s.college_name,
            s.profile_photo,
            (
                SELECT GROUP_CONCAT(sk.skill_name)
                FROM student_teach_skills sts
                JOIN skills sk ON sts.skill_id = sk.id
                WHERE sts.student_id = s.id
            ) AS skills_to_teach,
            (
                SELECT GROUP_CONCAT(sk.skill_name)
                FROM student_learn_skills sls
                JOIN skills sk ON sls.skill_id = sk.id
                WHERE sls.student_id = s.id
            ) AS skills_to_learn
        FROM students s
    `;

    db.query(sql, callback);
};

const getStudentById = (studentId, callback) => {
    const sql = `
        SELECT
            s.id,
            s.student_name,
            s.department,
            s.academic_year,
            s.college_name,
            s.profile_photo,
            sp.bio,
            sp.linkedin_url,
            sp.github_url,
            sp.mobile_number,
            sp.email,
            sp.other_contact,
            (
                SELECT GROUP_CONCAT(sk.skill_name)
                FROM student_teach_skills sts
                JOIN skills sk ON sts.skill_id = sk.id
                WHERE sts.student_id = s.id
            ) AS skills_to_teach,
            (
                SELECT GROUP_CONCAT(sk.skill_name)
                FROM student_learn_skills sls
                JOIN skills sk ON sls.skill_id = sk.id
                WHERE sls.student_id = s.id
            ) AS skills_to_learn
        FROM students s
        LEFT JOIN student_profiles sp
            ON sp.student_id = s.id
        WHERE s.id = ?
    `;

    db.query(sql, [studentId], callback);
};

const getMyProfile = (studentId, callback) => {
    const sql = `
        SELECT
            s.id,
            s.PRN,
            s.student_name,
            s.department,
            s.academic_year,
            s.college_name,
            s.profile_photo,
            sp.bio,
            sp.linkedin_url,
            sp.github_url,
            sp.mobile_number,
            sp.whatsapp_number,
            sp.email,
            sp.other_contact,
            (
                SELECT GROUP_CONCAT(sk.skill_name)
                FROM student_teach_skills sts
                JOIN skills sk ON sts.skill_id = sk.id
                WHERE sts.student_id = s.id
            ) AS skills_to_teach,
            (
                SELECT GROUP_CONCAT(sk.skill_name)
                FROM student_learn_skills sls
                JOIN skills sk ON sls.skill_id = sk.id
                WHERE sls.student_id = s.id
            ) AS skills_to_learn
        FROM students s
        LEFT JOIN student_profiles sp ON sp.student_id = s.id
        WHERE s.id = ?
    `;

    db.query(sql, [studentId], callback);
};


const getFilterOptions = (callback) => {
    const sql = `
        SELECT
            (SELECT JSON_ARRAYAGG(department)
             FROM (
                 SELECT DISTINCT department
                 FROM students
                 WHERE department IS NOT NULL AND department <> ''
                 ORDER BY department
             ) AS departments) AS departments,

            (SELECT JSON_ARRAYAGG(academic_year)
             FROM (
                 SELECT DISTINCT academic_year
                 FROM students
                 WHERE academic_year IS NOT NULL AND academic_year <> ''
                 ORDER BY academic_year
             ) AS years) AS academic_years,

            (SELECT JSON_ARRAYAGG(college_name)
             FROM (
                 SELECT DISTINCT college_name
                 FROM students
                 WHERE college_name IS NOT NULL AND college_name <> ''
                 ORDER BY college_name
             ) AS colleges) AS colleges,

            (SELECT JSON_ARRAYAGG(skill_name)
             FROM (
                 SELECT DISTINCT skill_name
                 FROM skills
                 WHERE skill_name IS NOT NULL AND skill_name <> ''
                 ORDER BY skill_name
             ) AS all_skills) AS skills
    `;

    db.query(sql, callback);
};


module.exports = {
    getAllStudents,
    getStudentById,
    getMyProfile,
    getFilterOptions,
    deleteMyAccount,
    updateMyProfile
};
