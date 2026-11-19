const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const db = require("../database");

const { JWT_SECRET, authenticateToken } = require("../middleware/auth");

const router = express.Router();


// ==========================================
// EMAIL CONFIGURATION
// ==========================================

const transporter = nodemailer.createTransport({

    service: "gmail",

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }

});


// ==========================================
// REGISTER
// ==========================================

router.post("/register", async (req, res) => {

    const {
        username,
        email,
        password
    } = req.body;


    if (!username || !email || !password) {

        return res.status(400).json({
            message:
                "Username, email and password are required."
        });

    }


    if (password.length < 6) {

        return res.status(400).json({
            message:
                "Password must be at least 6 characters."
        });

    }


    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (!emailRegex.test(email)) {

        return res.status(400).json({
            message: "Please enter a valid email."
        });

    }


    try {

        const existingUser =
            await new Promise((resolve, reject) => {

                db.get(
                    `
                    SELECT id
                    FROM users
                    WHERE username = ?
                       OR email = ?
                    `,
                    [
                        username,
                        email
                    ],
                    (err, user) => {

                        if (err) {
                            reject(err);
                        } else {
                            resolve(user);
                        }

                    }
                );

            });


        if (existingUser) {

            return res.status(400).json({
                message:
                    "Username or email already exists."
            });

        }


        const hashedPassword =
            await bcrypt.hash(password, 10);


        db.run(
            `
            INSERT INTO users
            (
                username,
                email,
                password
            )
            VALUES (?, ?, ?)
            `,
            [
                username,
                email,
                hashedPassword
            ],
            function (err) {

                if (err) {

                    console.error(err);

                    return res.status(500).json({
                        message:
                            "Registration failed."
                    });

                }


                res.status(201).json({

                    message:
                        "Registration successful.",

                    userId:
                        this.lastID

                });

            }
        );

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error."
        });

    }

});


// ==========================================
// LOGIN
// ==========================================

router.post("/login", (req, res) => {

    const {
        username,
        password
    } = req.body;


    if (!username || !password) {

        return res.status(400).json({
            message:
                "Username and password are required."
        });

    }


    db.get(
        `
        SELECT *
        FROM users
        WHERE username = ?
        `,
        [username],
        async (err, user) => {

            if (err) {

                console.error(err);

                return res.status(500).json({
                    message:
                        "Database error."
                });

            }


            if (!user) {

                return res.status(401).json({
                    message:
                        "Invalid username or password."
                });

            }


            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );


            if (!passwordMatch) {

                return res.status(401).json({
                    message:
                        "Invalid username or password."
                });

            }


            const token =
                jwt.sign(
                    {
                        id: user.id,
                        username: user.username
                    },
                    JWT_SECRET,
                    {
                        expiresIn: "7d"
                    }
                );


            res.json({

                message:
                    "Login successful.",

                token,

                username:
                    user.username

            });

        }
    );

});


// ==========================================
// AUTHENTICATED PROFILE SETTINGS
// ==========================================

router.get("/profile", authenticateToken, (req, res) => {
    db.get(
        `
        SELECT username, email
        FROM users
        WHERE id = ?
        `,
        [req.user.id],
        (err, user) => {
            if (err) {
                console.error("Profile lookup failed:", err);
                return res.status(500).json({
                    message: "Could not load profile settings."
                });
            }

            if (!user) {
                return res.status(404).json({
                    message: "User account not found."
                });
            }

            res.json({
                username: user.username,
                email: user.email || ""
            });
        }
    );
});

router.patch("/profile", authenticateToken, (req, res) => {
    const username = typeof req.body?.username === "string"
        ? req.body.username.trim()
        : "";
    const email = typeof req.body?.email === "string"
        ? req.body.email.trim()
        : "";

    if (!username || username.length > 50) {
        return res.status(400).json({
            message: "Username must be between 1 and 50 characters."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    db.get(
        `
        SELECT id
        FROM users
        WHERE (username = ? OR email = ?)
          AND id != ?
        `,
        [username, email, req.user.id],
        (lookupError, existingUser) => {
            if (lookupError) {
                console.error("Profile uniqueness check failed:", lookupError);
                return res.status(500).json({
                    message: "Could not update profile settings."
                });
            }

            if (existingUser) {
                return res.status(409).json({
                    message: "That username or email is already in use."
                });
            }

            db.run(
                `
                UPDATE users
                SET username = ?, email = ?
                WHERE id = ?
                `,
                [username, email, req.user.id],
                function (updateError) {
                    if (updateError) {
                        console.error("Profile update failed:", updateError);
                        return res.status(500).json({
                            message: "Could not update profile settings."
                        });
                    }

                    if (this.changes === 0) {
                        return res.status(404).json({
                            message: "User account not found."
                        });
                    }

                    res.json({
                        message: "Profile settings updated.",
                        username,
                        email
                    });
                }
            );
        }
    );
});

router.post("/change-password", authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};

    if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        !newPassword
    ) {
        return res.status(400).json({
            message: "Current and new passwords are required."
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            message: "New password must be at least 6 characters."
        });
    }

    db.get(
        "SELECT password FROM users WHERE id = ?",
        [req.user.id],
        async (lookupError, user) => {
            if (lookupError) {
                console.error("Password settings lookup failed:", lookupError);
                return res.status(500).json({
                    message: "Could not verify the current password."
                });
            }

            if (!user) {
                return res.status(404).json({
                    message: "User account not found."
                });
            }

            try {
                const passwordMatches = await bcrypt.compare(
                    currentPassword,
                    user.password
                );

                if (!passwordMatches) {
                    return res.status(400).json({
                        message: "Current password is incorrect."
                    });
                }

                const hashedPassword = await bcrypt.hash(newPassword, 10);
                db.run(
                    `
                    UPDATE users
                    SET password = ?, reset_token = NULL, reset_token_expires = NULL
                    WHERE id = ?
                    `,
                    [hashedPassword, req.user.id],
                    (updateError) => {
                        if (updateError) {
                            console.error("Password update failed:", updateError);
                            return res.status(500).json({
                                message: "Could not update the password."
                            });
                        }

                        res.json({
                            message: "Password updated successfully."
                        });
                    }
                );
            } catch (error) {
                console.error("Password settings update failed:", error);
                res.status(500).json({
                    message: "Could not update the password."
                });
            }
        }
    );
});


// ==========================================
// FORGOT PASSWORD
// ==========================================

router.post(
    "/forgot-password",
    (req, res) => {

        const { email } =
            req.body;


        if (!email) {

            return res.status(400).json({
                message:
                    "Email is required."
            });

        }


        db.get(
            `
            SELECT id, username, email
            FROM users
            WHERE email = ?
            `,
            [email],
            async (err, user) => {

                if (err) {

                    console.error(err);

                    return res.status(500).json({
                        message:
                            "Database error."
                    });

                }


                /*
                 * For security, don't reveal
                 * whether the email exists.
                 */

                if (!user) {

                    return res.json({
                        message:
                            "If that email exists, a reset link has been sent."
                    });

                }


                // Generate secure random token
                const resetToken =
                    crypto
                        .randomBytes(32)
                        .toString("hex");


                // Token valid for 15 minutes
                const expiry =
                    Date.now() +
                    15 * 60 * 1000;


                db.run(
                    `
                    UPDATE users
                    SET
                        reset_token = ?,
                        reset_token_expires = ?
                    WHERE id = ?
                    `,
                    [
                        resetToken,
                        expiry,
                        user.id
                    ],
                    async (updateErr) => {

                        if (updateErr) {

                            console.error(
                                updateErr
                            );

                            return res.status(500).json({
                                message:
                                    "Could not create reset request."
                            });

                        }


                        const frontendUrl =
                            process.env.FRONTEND_URL ||
                            "http://localhost:5173";


                        const resetLink =
                            `${frontendUrl}/?resetToken=${resetToken}`;


                        try {

                            await transporter.sendMail({

                                from:
                                    process.env.EMAIL_USER,

                                to:
                                    user.email,

                                subject:
                                    "PersonalStorage Password Reset",

                                html: `
                                    <div style="font-family:Arial,sans-serif;">
                                        <h2>PersonalStorage</h2>

                                        <p>Hello ${user.username},</p>

                                        <p>
                                            We received a request to reset
                                            your password.
                                        </p>

                                        <p>
                                            Click the button below to create
                                            a new password:
                                        </p>

                                        <p>
                                            <a
                                                href="${resetLink}"
                                                style="
                                                    display:inline-block;
                                                    padding:12px 20px;
                                                    background:#2563eb;
                                                    color:white;
                                                    text-decoration:none;
                                                    border-radius:6px;
                                                "
                                            >
                                                Reset Password
                                            </a>
                                        </p>

                                        <p>
                                            This link expires in
                                            <strong>15 minutes</strong>.
                                        </p>

                                        <p>
                                            If you did not request this,
                                            you can ignore this email.
                                        </p>
                                    </div>
                                `

                            });


                            res.json({

                                message:
                                    "If that email exists, a reset link has been sent."

                            });


                        } catch (mailError) {

                            console.error(
                                "Email error:",
                                mailError
                            );

                            return res.status(500).json({
                                message:
                                    "Could not send reset email."
                            });

                        }

                    }
                );

            }
        );

    }
);


// ==========================================
// RESET PASSWORD
// ==========================================

router.post(
    "/reset-password",
    async (req, res) => {

        const {
            token,
            newPassword
        } = req.body;


        if (!token || !newPassword) {

            return res.status(400).json({
                message:
                    "Reset token and new password are required."
            });

        }


        if (newPassword.length < 6) {

            return res.status(400).json({
                message:
                    "Password must be at least 6 characters."
            });

        }


        db.get(
            `
            SELECT id
            FROM users
            WHERE reset_token = ?
              AND reset_token_expires > ?
            `,
            [
                token,
                Date.now()
            ],
            async (err, user) => {

                if (err) {

                    console.error(err);

                    return res.status(500).json({
                        message:
                            "Database error."
                    });

                }


                if (!user) {

                    return res.status(400).json({
                        message:
                            "Reset link is invalid or expired."
                    });

                }


                try {

                    const hashedPassword =
                        await bcrypt.hash(
                            newPassword,
                            10
                        );


                    db.run(
                        `
                        UPDATE users
                        SET
                            password = ?,
                            reset_token = NULL,
                            reset_token_expires = NULL
                        WHERE id = ?
                        `,
                        [
                            hashedPassword,
                            user.id
                        ],
                        (updateErr) => {

                            if (updateErr) {

                                console.error(
                                    updateErr
                                );

                                return res.status(500).json({
                                    message:
                                        "Could not reset password."
                                });

                            }


                            res.json({

                                message:
                                    "Password reset successfully."

                            });

                        }
                    );

                } catch (error) {

                    console.error(error);

                    res.status(500).json({
                        message:
                            "Server error."
                    });

                }

            }
        );

    }
);


module.exports = router;