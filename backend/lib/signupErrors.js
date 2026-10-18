function signupFailure(error) {
    if (error.code === "ER_DUP_ENTRY") {
        const constraint = String(error.signupConstraint || "").toLowerCase();
        if (constraint.includes("email")) {
            return {
                status: 409,
                message: "An account with this email already exists. Please log in or use another email address."
            };
        }
        if (constraint === "prn" || constraint.endsWith("_prn")) {
            return {
                status: 409,
                message: "This PRN is already registered. Check your PRN and try again."
            };
        }
        return {
            status: 409,
            message: "An account with these details already exists. Check your PRN and email address."
        };
    }

    if (error.code === "ER_LOCK_WAIT_TIMEOUT" ||
        error.code === "ER_LOCK_DEADLOCK" ||
        error.signupOperation === "acquire connection" ||
        error.signupOperation === "begin transaction" ||
        error.code === "ER_NO_SUCH_TABLE" ||
        error.code === "ECONNREFUSED" ||
        error.code === "PROTOCOL_CONNECTION_LOST") {
        return {
            status: 503,
            message: "Signup is temporarily unavailable. Please try again later."
        };
    }

    if (error.signupOperation) {
        return {
            status: 503,
            message: "Signup is temporarily unavailable. Please try again later."
        };
    }

    return {
        status: 500,
        message: "Unable to complete signup. Please try again."
    };
}

module.exports = { signupFailure };
