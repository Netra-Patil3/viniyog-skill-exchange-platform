const studentModel = require("../models/studentModel");

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

module.exports = {
    getStudents
};