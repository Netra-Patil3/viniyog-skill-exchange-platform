const defaults = [
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
];

const trustedOrigins = new Set([
    ...defaults,
    ...(process.env.FRONTEND_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
]);

module.exports = { trustedOrigins };
