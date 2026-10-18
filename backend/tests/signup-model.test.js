const { after, test } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../config/db");
const signupModel = require("../models/signupModel");

after(async () => {
    await new Promise((resolve) => {
        db.getConnection((error, connection) => {
            if (connection) {
                connection.release();
            }
            resolve();
        });
    });
    await db.promise().end();
});

function makeConnection(failingOperation) {
    const state = {
        begun: false,
        committed: false,
        rolledBack: false,
        released: false,
        operations: []
    };
    const connection = {
        beginTransaction(callback) {
            state.begun = true;
            callback(null);
        },
        query(sql, values, callback) {
            let operation;
            if (sql.includes("INSERT INTO students")) {
                operation = "insert student";
            } else if (sql.includes("INSERT INTO student_profiles")) {
                operation = "insert profile";
            } else if (sql.includes("INSERT INTO student_auth")) {
                operation = "insert authentication";
            } else {
                throw new Error(`Unexpected SQL in signup test: ${sql}`);
            }
            state.operations.push(operation);
            if (operation === failingOperation) {
                const error = new Error("simulated database error");
                error.code = failingOperation === "insert student"
                    ? "ER_LOCK_WAIT_TIMEOUT"
                    : "ER_DUP_ENTRY";
                error.sqlMessage = "Duplicate entry '[redacted]' for key 'uq_student_profiles_email'";
                return callback(error);
            }
            callback(null, operation === "insert student" ? { insertId: 501 } : {});
        },
        commit(callback) {
            state.committed = true;
            callback(null);
        },
        rollback(callback) {
            state.rolledBack = true;
            callback(null);
        },
        release() {
            state.released = true;
        }
    };
    return { connection, state };
}

function registerWith(connection) {
    return new Promise((resolve, reject) => {
        signupModel.registerStudent(
            {
                prn: "NEW-PRN",
                studentName: "New Student",
                department: "Computer Science",
                academicYear: "2nd Year",
                collegeName: "Example College",
                profilePhoto: null
            },
            {
                bio: null,
                linkedin: null,
                github: null,
                mobileNumber: null,
                whatsappNumber: null,
                email: "new@example.edu",
                otherContact: null
            },
            "hashed-password",
            [],
            [],
            (error, studentId) => error ? reject(error) : resolve(studentId)
        );
    });
}

async function withConnection(connection, callback) {
    const originalGetConnection = db.getConnection;
    db.getConnection = (done) => done(null, connection);
    try {
        return await callback();
    } finally {
        db.getConnection = originalGetConnection;
    }
}

test("signup commits all account records in one transaction on success", async () => {
    const { connection, state } = makeConnection();
    const studentId = await withConnection(connection, () => registerWith(connection));

    assert.equal(studentId, 501);
    assert.equal(state.begun, true);
    assert.equal(state.committed, true);
    assert.equal(state.rolledBack, false);
    assert.equal(state.released, true);
    assert.deepEqual(state.operations, [
        "insert student",
        "insert profile",
        "insert authentication"
    ]);
});

test("signup rolls back partial student data after a profile email conflict", async () => {
    const { connection, state } = makeConnection("insert profile");

    await assert.rejects(
        withConnection(connection, () => registerWith(connection)),
        (error) => {
            assert.equal(error.code, "ER_DUP_ENTRY");
            assert.equal(error.signupOperation, "insert profile");
            assert.equal(error.signupConstraint, "uq_student_profiles_email");
            return true;
        }
    );

    assert.equal(state.committed, false);
    assert.equal(state.rolledBack, true);
    assert.equal(state.released, true);
    assert.deepEqual(state.operations, ["insert student", "insert profile"]);
});

test("signup rolls back after a database lock timeout", async () => {
    const { connection, state } = makeConnection("insert student");

    await assert.rejects(
        withConnection(connection, () => registerWith(connection)),
        (error) => {
            assert.equal(error.code, "ER_LOCK_WAIT_TIMEOUT");
            assert.equal(error.signupOperation, "insert student");
            return true;
        }
    );

    assert.equal(state.committed, false);
    assert.equal(state.rolledBack, true);
    assert.equal(state.released, true);
});
