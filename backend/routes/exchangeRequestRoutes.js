const express = require("express");
const controller = require("../controllers/exchangeRequestController");
const { requireAuth, requireTrustedOrigin } = require("../lib/session");

const router = express.Router();

router.get("/exchange-requests", requireAuth, controller.getExchangeRequests);
router.post(
    "/exchange-requests",
    requireTrustedOrigin,
    requireAuth,
    controller.createExchangeRequest
);

module.exports = router;
