
const express = require("express");
const studentController = require("../controllers/studentController");
const { requireAuth, requireTrustedOrigin } = require("../lib/session");
const { uploadProfilePhoto } = require("../lib/profilePhotoUpload");

const router = express.Router();

// Get all students
router.get("/students", requireAuth, studentController.getStudents);
router.get("/students/filter-options", requireAuth, studentController.getFilterOptions);
router.post(
    "/students/me/delete-account",
    requireTrustedOrigin,
    requireAuth,
    studentController.deleteMyAccount
);
router.put(
    "/students/me/profile",
    requireTrustedOrigin,
    requireAuth,
    uploadProfilePhoto.single("profilePhoto"),
    studentController.updateMyProfile
);
// Get one student's profile by ID
router.get("/students/:id", requireAuth, studentController.getStudentById);

module.exports = router;
