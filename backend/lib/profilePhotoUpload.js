const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const profilePhotoDirectory = path.resolve(
    __dirname,
    "../../frontend/assets/profile photos"
);
fs.mkdirSync(profilePhotoDirectory, { recursive: true });

const extensions = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};

const uploadProfilePhoto = multer({
    storage: multer.diskStorage({
        destination: profilePhotoDirectory,
        filename: (req, file, callback) => {
            callback(null, `${crypto.randomUUID()}${extensions[file.mimetype]}`);
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 30,
        fieldSize: 4096,
        parts: 32
    },
    fileFilter: (req, file, callback) => {
        if (!extensions[file.mimetype]) {
            return callback(new Error("Only JPG, PNG, and WEBP images are allowed."));
        }
        return callback(null, true);
    }
});

function validImageSignature(fileBuffer, mimeType) {
    if (mimeType === "image/jpeg") {
        return fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff;
    }
    if (mimeType === "image/png") {
        return fileBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    if (mimeType === "image/webp") {
        return fileBuffer.toString("ascii", 0, 4) === "RIFF" &&
            fileBuffer.toString("ascii", 8, 12) === "WEBP";
    }
    return false;
}

module.exports = {
    profilePhotoDirectory,
    uploadProfilePhoto,
    validImageSignature
};
