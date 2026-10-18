const db = require("../config/db");

async function createExchangeRequest(requesterId, recipientId, offeredSkill, requestedSkill, message) {
    const connection = await db.promise().getConnection();

    try {
        await connection.beginTransaction();

        const [matches] = await connection.execute(
            `SELECT offered.id AS offered_skill_id,
                    requested.id AS requested_skill_id
             FROM student_teach_skills requester_skills
             JOIN skills offered ON offered.id = requester_skills.skill_id
             JOIN student_teach_skills recipient_skills
                 ON recipient_skills.student_id = ?
             JOIN skills requested ON requested.id = recipient_skills.skill_id
             WHERE requester_skills.student_id = ?
               AND LOWER(offered.skill_name) = LOWER(?)
               AND LOWER(requested.skill_name) = LOWER(?)
             LIMIT 1`,
            [recipientId, requesterId, offeredSkill, requestedSkill]
        );

        if (!matches.length) {
            const error = new Error("Choose a skill you teach and a skill the other student teaches.");
            error.statusCode = 400;
            throw error;
        }

        const [pending] = await connection.execute(
            `SELECT id FROM skill_exchange_requests
             WHERE requester_student_id = ? AND recipient_student_id = ?
               AND status = 'pending'
             LIMIT 1`,
            [requesterId, recipientId]
        );
        if (pending.length) {
            const error = new Error("You already have a pending request with this student.");
            error.statusCode = 409;
            throw error;
        }

        const [result] = await connection.execute(
            `INSERT INTO skill_exchange_requests
                (requester_student_id, recipient_student_id,
                 offered_skill_id, requested_skill_id, message)
             VALUES (?, ?, ?, ?, ?)`,
            [
                requesterId,
                recipientId,
                matches[0].offered_skill_id,
                matches[0].requested_skill_id,
                message || null
            ]
        );

        await connection.commit();
        return result.insertId;
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error("Exchange request rollback failed:", rollbackError.message);
        }
        throw error;
    } finally {
        connection.release();
    }
}

async function getStudentExchangeRequests(studentId) {
    const [rows] = await db.promise().execute(
        `SELECT er.id,
                er.requester_student_id,
                er.recipient_student_id,
                er.message,
                er.status,
                er.created_at,
                requester.student_name AS requester_name,
                recipient.student_name AS recipient_name,
                offered.skill_name AS offered_skill,
                requested.skill_name AS requested_skill
         FROM skill_exchange_requests er
         JOIN students requester ON requester.id = er.requester_student_id
         JOIN students recipient ON recipient.id = er.recipient_student_id
         JOIN skills offered ON offered.id = er.offered_skill_id
         JOIN skills requested ON requested.id = er.requested_skill_id
         WHERE er.requester_student_id = ? OR er.recipient_student_id = ?
         ORDER BY er.created_at DESC`,
        [studentId, studentId]
    );

    return rows.map((row) => ({
        id: row.id,
        direction: row.requester_student_id === studentId ? "outgoing" : "incoming",
        other_student_name: row.requester_student_id === studentId
            ? row.recipient_name
            : row.requester_name,
        offered_skill: row.offered_skill,
        requested_skill: row.requested_skill,
        message: row.message,
        status: row.status,
        created_at: row.created_at
    }));
}

module.exports = { createExchangeRequest, getStudentExchangeRequests };
