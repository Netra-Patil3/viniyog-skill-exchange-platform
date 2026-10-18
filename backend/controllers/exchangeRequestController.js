const exchangeRequestModel = require("../models/exchangeRequestModel");

async function createExchangeRequest(req, res) {
    const recipientInput = String(req.body.recipientStudentId ?? "");
    const recipientId = /^[1-9]\d*$/.test(recipientInput)
        ? Number(recipientInput)
        : NaN;
    const offeredSkill = typeof req.body.offeredSkill === "string"
        ? req.body.offeredSkill.trim()
        : "";
    const requestedSkill = typeof req.body.requestedSkill === "string"
        ? req.body.requestedSkill.trim()
        : "";
    const message = typeof req.body.message === "string"
        ? req.body.message.trim()
        : "";

    if (!Number.isSafeInteger(recipientId) || recipientId <= 0 ||
        recipientId === req.student.id ||
        !offeredSkill || offeredSkill.length > 100 ||
        !requestedSkill || requestedSkill.length > 100 ||
        message.length > 500) {
        return res.status(400).json({ message: "Please provide a valid student, both skills, and a message of 500 characters or fewer." });
    }

    try {
        const requestId = await exchangeRequestModel.createExchangeRequest(
            req.student.id,
            recipientId,
            offeredSkill,
            requestedSkill,
            message
        );
        return res.status(201).json({
            message: "Skill exchange request sent.",
            requestId
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Exchange request creation failed:", error.message);
        return res.status(500).json({ message: "Unable to send the exchange request." });
    }
}

async function getExchangeRequests(req, res) {
    try {
        const requests = await exchangeRequestModel.getStudentExchangeRequests(req.student.id);
        return res.status(200).json(requests);
    } catch (error) {
        console.error("Exchange request lookup failed:", error.message);
        return res.status(500).json({ message: "Unable to load exchange requests." });
    }
}

module.exports = { createExchangeRequest, getExchangeRequests };
