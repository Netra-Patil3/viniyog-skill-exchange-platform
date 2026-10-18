const express = require("express");
const loginController = require("../controllers/loginController");
const { requireAuth, requireTrustedOrigin } = require("../lib/session");

const router = express.Router();

router.get("/auth/me", requireAuth, loginController.getCurrentStudent);
router.post("/logout", requireTrustedOrigin, loginController.logoutStudent);

module.exports = router;
