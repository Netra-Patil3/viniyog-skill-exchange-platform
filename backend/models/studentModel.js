const db = require("../config/db");

const getAllStudents = (callback) => {
    const sql = "SELECT * FROM students";

    db.query(sql, callback);
};

module.exports = {
    getAllStudents
};