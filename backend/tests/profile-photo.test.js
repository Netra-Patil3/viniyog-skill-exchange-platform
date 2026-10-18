const { after, test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const db = require("../config/db");
const { profilePhotoDirectory } = require("../lib/profilePhotoUpload");
const studentModel = require("../models/studentModel");

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

async function withProfilePhotoUpdate({
    currentPhoto,
    replacementPhoto,
    removeProfilePhoto,
    referenceCount = 0
}) {
    const photoFilePath = path.join(profilePhotoDirectory, path.basename(currentPhoto));
    await fs.writeFile(photoFilePath, "temporary profile photo");

    let storedPhoto = currentPhoto;
    const connection = {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
        async execute(query, values) {
            if (query.startsWith("SELECT profile_photo FROM students")) {
                return [[{ profile_photo: storedPhoto }]];
            }
            if (query.startsWith("UPDATE students SET profile_photo")) {
                storedPhoto = values[0];
                return [{ affectedRows: 1 }];
            }
            throw new Error(`Unexpected connection query: ${query}`);
        }
    };

    const originalPromise = db.promise;
    db.promise = () => ({
        getConnection: async () => connection,
        async execute(query) {
            if (query.startsWith("SELECT COUNT(*) AS reference_count FROM students")) {
                return [[{ reference_count: referenceCount }]];
            }
            throw new Error(`Unexpected pool query: ${query}`);
        }
    });

    try {
        const result = await studentModel.updateMyProfile(
            123,
            replacementPhoto,
            removeProfilePhoto,
            {}
        );
        return { result, storedPhoto, photoFilePath };
    } catch (error) {
        await fs.rm(photoFilePath, { force: true });
        throw error;
    } finally {
        db.promise = originalPromise;
    }
}

test("replacing a photo updates the profile and cleans an unreferenced managed photo", async () => {
    const temporary = `${crypto.randomUUID()}.jpg`;
    const currentPhoto = `assets/profile photos/${temporary}`;
    const replacementPhoto = `assets/profile photos/${crypto.randomUUID()}.jpg`;
    const result = await withProfilePhotoUpdate({ currentPhoto, replacementPhoto });

    try {
        assert.equal(result.storedPhoto, replacementPhoto);
        assert.equal(result.result.photoCleanupFailed, false);
        await assert.rejects(fs.access(result.photoFilePath), { code: "ENOENT" });
    } finally {
        await fs.rm(result.photoFilePath, { force: true });
    }
});

test("removing a photo stores null and cleans the unreferenced managed photo", async () => {
    const currentPhoto = `assets/profile photos/${crypto.randomUUID()}.jpg`;
    const result = await withProfilePhotoUpdate({
        currentPhoto,
        replacementPhoto: null,
        removeProfilePhoto: true
    });

    try {
        assert.equal(result.storedPhoto, null);
        assert.equal(result.result.photoCleanupFailed, false);
        await assert.rejects(fs.access(result.photoFilePath), { code: "ENOENT" });
    } finally {
        await fs.rm(result.photoFilePath, { force: true });
    }
});

test("a managed photo still referenced by another student is preserved", async () => {
    const currentPhoto = `assets/profile photos/${crypto.randomUUID()}.jpg`;
    const result = await withProfilePhotoUpdate({
        currentPhoto,
        replacementPhoto: null,
        removeProfilePhoto: true,
        referenceCount: 1
    });

    try {
        assert.equal(result.storedPhoto, null);
        assert.equal(result.result.photoCleanupFailed, false);
        await fs.access(result.photoFilePath);
    } finally {
        await fs.rm(result.photoFilePath, { force: true });
    }
});
