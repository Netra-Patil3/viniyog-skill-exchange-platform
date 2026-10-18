const test = require("node:test");
const assert = require("node:assert/strict");
const {
    parseSkills,
    validOptionalUrl,
    validateProfileUpdate,
    validateSignup
} = require("../lib/validation");

function signupPayload(overrides) {
    return {
        fullName: "A Student",
        prn: "PRN-12345",
        department: "Computer Science",
        academicYear: "2nd Year",
        college: "Example College",
        email: "STUDENT@example.edu",
        password: "secure-password",
        confirmPassword: "secure-password",
        phone: "+1 555 0100",
        teachSkills: "JavaScript, Writing",
        learnSkills: "Python",
        terms: "on",
        ...overrides
    };
}

test("signup normalizes email and deduplicates skills", () => {
    const result = validateSignup(signupPayload({
        teachSkills: " JavaScript, javascript, Writing "
    }));

    assert.equal(result.error, undefined);
    assert.equal(result.values.email, "student@example.edu");
    assert.deepEqual(result.teachSkills, ["JavaScript", "Writing"]);
});

test("signup rejects missing required fields and unaccepted terms", () => {
    assert.match(validateSignup(signupPayload({ terms: "" })).error, /required fields/);
    assert.match(validateSignup(signupPayload({ email: "bad-address" })).error, /email/);
});

test("signup rejects oversized bcrypt input and mismatched passwords", () => {
    assert.match(validateSignup(signupPayload({ password: "short" })).error, /8 to 72/);
    assert.match(validateSignup(signupPayload({ password: "valid-password", confirmPassword: "different-password" })).error, /do not match/);
    assert.match(validateSignup(signupPayload({ password: "é".repeat(37), confirmPassword: "é".repeat(37) })).error, /8 to 72/);
});

test("skills are required, capped, and limited by per-skill length", () => {
    assert.equal(parseSkills(" , "), null);
    assert.equal(parseSkills(Array.from({ length: 21 }, (_, index) => `skill${index}`).join(",")), null);
    assert.equal(parseSkills("x".repeat(101)), null);
    assert.deepEqual(parseSkills("Math, math"), ["Math"]);
});

test("profile links only accept HTTP and HTTPS", () => {
    assert.equal(validOptionalUrl("https://example.com/profile"), true);
    assert.equal(validOptionalUrl("javascript:alert(1)"), false);
    assert.equal(validOptionalUrl("not a URL"), false);
});

test("signup rejects invalid URLs and missing contact methods", () => {
    assert.match(validateSignup(signupPayload({ linkedin: "javascript:alert(1)" })).error, /HTTP or HTTPS/);
    assert.match(validateSignup(signupPayload({
        phone: "",
        whatsapp: "",
        linkedin: "",
        github: "",
        portfolio: "",
        otherContact: ""
    })).error, /contact method/);
});

test("profile update requires bounded teach and learn skill lists", () => {
    const valid = validateProfileUpdate({
        teachSkills: "JavaScript, Writing, javascript",
        learnSkills: "Python"
    });
    assert.deepEqual(valid.updates.teachSkills, ["JavaScript", "Writing"]);
    assert.deepEqual(valid.updates.learnSkills, ["Python"]);

    assert.deepEqual(validateProfileUpdate({
        teachSkills: " , ",
        learnSkills: "Python"
    }).updates, { teachSkills: [], learnSkills: ["Python"] });
    assert.match(validateProfileUpdate({
        teachSkills: Array.from({ length: 21 }, (_, index) => `skill${index}`).join(","),
        learnSkills: "Python"
    }).error, /20 teaching skills/);
    assert.match(validateProfileUpdate({
        teachSkills: "x".repeat(101),
        learnSkills: "Python"
    }).error, /20 teaching skills/);
});

test("profile updates validate only submitted fields and validate account contacts", () => {
    assert.deepEqual(validateProfileUpdate({ bio: "  I like learning.  " }).updates, {
        bio: "I like learning."
    });
    assert.deepEqual(validateProfileUpdate({
        email: " STUDENT@example.edu ",
        mobileNumber: "+1 (555) 010-1234"
    }).updates, {
        email: "student@example.edu",
        mobileNumber: "+1 (555) 010-1234"
    });
    assert.match(validateProfileUpdate({ bio: "x".repeat(301) }).error, /300 characters/);
    assert.match(validateProfileUpdate({ email: "not-an-email" }).error, /email address/);
    assert.match(validateProfileUpdate({ mobileNumber: "123" }).error, /mobile number/);
    assert.deepEqual(validateProfileUpdate({}).updates, {});
});
