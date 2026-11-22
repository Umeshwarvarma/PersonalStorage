require("dotenv").config();

const express = require("express");
const cors = require("cors");

if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error("Production requires a JWT_SECRET of at least 32 characters.");
    }

    if (!process.env.FRONTEND_URL) {
        throw new Error("Production requires FRONTEND_URL for CORS configuration.");
    }
}

const authRoutes = require("./routes/auth");
const fileRoutes = require("./routes/files");

const app = express();

const PORT = process.env.PORT || 5000;
const configuredOrigins = (
    process.env.FRONTEND_URL ||
    "http://localhost:5173,http://127.0.0.1:5173"
)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);


// ==========================================
// CORS
// ==========================================

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || configuredOrigins.includes(origin)) {
                callback(null, true);
                return;
            }

            callback(null, false);
        },
        credentials: true,
        exposedHeaders: ["Content-Disposition", "X-Original-Size"]
    })
);


// ==========================================
// JSON
// ==========================================

app.use(
    express.json({ limit: "1mb" })
);


// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {

    res.json({
        message:
            "Personal Storage Backend is Running"
    });

});

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});


// ==========================================
// ROUTES
// ==========================================

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/files",
    fileRoutes
);

app.use("/api", (req, res) => {
    res.status(404).json({ message: "API route not found." });
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        next(error);
        return;
    }

    console.error("Request failed:", error);
    const statusCode = Number.isInteger(error.status) ? error.status : 500;
    const message = statusCode === 413
        ? "Request body is too large."
        : statusCode === 400
            ? "Request body is invalid."
            : "Internal server error.";

    res.status(statusCode).json({ message });
});


// ==========================================
// START SERVER
// ==========================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================="
        );

        console.log(
            "   PERSONAL STORAGE BACKEND"
        );

        console.log(
            "================================="
        );

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            "================================="
        );

    }
);