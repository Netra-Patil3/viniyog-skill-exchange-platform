const bcrypt = require("bcrypt");

async function findStudentForPassword(candidates, password) {
    for (const candidate of candidates) {
        if (await bcrypt.compare(password, candidate.password_hash)) {
            return candidate;
        }
    }
    return null;
}

module.exports = { findStudentForPassword };
