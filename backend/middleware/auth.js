const jwt = require("jsonwebtoken");

const JWT_SECRET = "personal_storage_secret_2026";

function authenticateToken(req, res, next) {

    const authHeader = req.headers.authorization;

    const token =
        authHeader &&
        authHeader.split(" ")[1];

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

                return res.status(403).json({
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