const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production"
        ? ""
        : "personal_storage_secret_2026");

if (process.env.NODE_ENV === "production" && JWT_SECRET.length < 32) {
    throw new Error("Production requires a JWT_SECRET of at least 32 characters.");
}

function authenticateToken(req, res, next) {

    const authHeader =
        req.headers.authorization;

    const match =
        typeof authHeader === "string" &&
        authHeader.match(/^Bearer\s+(\S+)$/i);
    const token = match && match[1];

    if (!token) {

        return res.status(401).json({
            message: "Access denied. Please login."
        });

    }

    jwt.verify(
        token,
        JWT_SECRET,
        (err, user) => {

            if (err) {

                return res.status(401).json({
                    message: "Invalid or expired token."
                });
            }

            if (!Number.isSafeInteger(user?.id) || user.id <= 0) {
                return res.status(401).json({
                    message: "Invalid or expired token."
                });
            }

            req.user = user;

            next();
        }
    );
}

module.exports = {
    authenticateToken,
    JWT_SECRET
};