const test = require("node:test");
const assert = require("node:assert/strict");
const { signupFailure } = require("../lib/signupErrors");

test("email unique-key conflicts return a specific duplicate-email message", () => {
    assert.deepEqual(signupFailure({
        code: "ER_DUP_ENTRY",
        signupConstraint: "uq_student_profiles_email"
    }), {
        status: 409,
        message: "An account with this email already exists. Please log in or use another email address."
    });
});

test("PRN unique-key conflicts are not misreported as duplicate emails", () => {
    assert.deepEqual(signupFailure({
        code: "ER_DUP_ENTRY",
        signupConstraint: "PRN"
    }), {
        status: 409,
        message: "This PRN is already registered. Check your PRN and try again."
    });
});

test("unknown unique-key conflicts receive a safe generic message", () => {
    assert.deepEqual(signupFailure({
        code: "ER_DUP_ENTRY",
        signupConstraint: "student_id"
    }), {
        status: 409,
        message: "An account with these details already exists. Check your PRN and email address."
    });
});

test("lock timeouts and deadlocks return a temporary-unavailability message", () => {
    for (const code of ["ER_LOCK_WAIT_TIMEOUT", "ER_LOCK_DEADLOCK"]) {
        assert.deepEqual(signupFailure({ code }), {
            status: 503,
            message: "Signup is temporarily unavailable. Please try again later."
        });
    }
});

test("unexpected errors do not expose database details", () => {
    assert.deepEqual(signupFailure({
        code: "ER_PARSE_ERROR",
        sqlMessage: "Private database diagnostic"
    }), {
        status: 500,
        message: "Unable to complete signup. Please try again."
    });
});
