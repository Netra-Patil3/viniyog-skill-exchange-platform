
const express = require("express");
const loginController = require("../controllers/loginController");
const { requireTrustedOrigin } = require("../lib/session");

const router = express.Router();

router.post("/login", requireTrustedOrigin, loginController.loginStudent);

module.exports = router;
