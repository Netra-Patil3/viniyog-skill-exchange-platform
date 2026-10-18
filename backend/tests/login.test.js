const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const { findStudentForPassword } = require("../lib/passwordAuthentication");

test("login selects the matching account when an email has duplicate profile rows", async () => {
    const passwordHash = await bcrypt.hash("existing-password", 4);
    const candidates = [
        { id: 1, password_hash: await bcrypt.hash("different-password", 4) },
        { id: 2, password_hash: passwordHash }
    ];

    assert.equal((await findStudentForPassword(candidates, "existing-password")).id, 2);
    assert.equal(await findStudentForPassword(candidates, "invalid-password"), null);
});
