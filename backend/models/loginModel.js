
const db = require("../config/db");

const getStudentByIdentifier = (identifier, callback) => {
    const sql = `
        SELECT
            s.id,
            s.PRN,
            s.student_name,
            sa.password_hash
        FROM students s
        JOIN student_auth sa
            ON sa.student_id = s.id
        LEFT JOIN student_profiles sp
            ON sp.student_id = s.id
        WHERE s.PRN = ? OR LOWER(sp.email) = LOWER(?)
        ORDER BY (s.PRN = ?) DESC
    `;

    db.query(sql, [identifier, identifier, identifier], callback);
};

module.exports = {
    getStudentByIdentifier
};
