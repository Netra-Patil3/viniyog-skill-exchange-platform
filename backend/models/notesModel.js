const db = require("../config/db");

function createNote(studentId, title, fileName, filePath, callback) {
    const sql = `
        INSERT INTO notes (student_id, title, file_name, file_path)
        VALUES (?, ?, ?, ?)
    `;
    db.query(sql, [studentId, title, fileName, filePath], callback);
}

function getAllNotes(callback) {
    const sql = `
        SELECT n.id, n.title, n.file_name, n.uploaded_at,
               s.student_name AS uploader_name
        FROM notes n
        JOIN students s ON s.id = n.student_id
        ORDER BY n.uploaded_at DESC, n.id DESC
    `;
    db.query(sql, callback);
}

function getNoteById(noteId, callback) {
    const sql = `
        SELECT id, title, file_name, file_path
        FROM notes
        WHERE id = ?
        LIMIT 1
    `;
    db.query(sql, [noteId], callback);
}

function getNotesByStudentId(studentId, callback) {
    const sql = `
        SELECT id, student_id, title, file_name, uploaded_at
        FROM notes
        WHERE student_id = ?
        ORDER BY uploaded_at DESC, id DESC
    `;

    db.query(sql, [studentId], callback);
}

module.exports = { createNote, getAllNotes, getNoteById, getNotesByStudentId };
