const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../database");

const {
    JWT_SECRET
} = require("../middleware/auth");

const router = express.Router();


// ===============================
// REGISTER
// ===============================

router.post("/register", async (req, res) => {

    const {
        username,
        password
    } = req.body;

    if (!username || !password) {

        return res.status(400).json({
            message: "Username and password are required."
        });

    }

    if (password.length < 6) {

        return res.status(400).json({
            message: "Password must be at least 6 characters."
        });

    }

    try {

        const hashedPassword =
            await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users
            (username, password)
            VALUES (?, ?)
        `;

        db.run(
            sql,
            [
                username,
                hashedPassword
            ],
            function (err) {

                if (err) {

                    if (
                        err.message.includes("UNIQUE")
                    ) {

                        return res.status(400).json({
                            message: "Username already exists."
                        });

                    }

                    console.error(err);

                    return res.status(500).json({
                        message: "Registration failed."
                    });

                }

                res.status(201).json({
                    message: "Registration successful.",
                    userId: this.lastID
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


// ===============================
// LOGIN
// ===============================

router.post("/login", (req, res) => {

    const {
        username,
        password
    } = req.body;

    if (!username || !password) {

        return res.status(400).json({
            message: "Username and password are required."
        });

    }

    const sql = `
        SELECT *
        FROM users
        WHERE username = ?
    `;

    db.get(
        sql,
        [username],
        async (err, user) => {

            if (err) {

                console.error(err);

                return res.status(500).json({
                    message: "Database error."
                });

            }

            if (!user) {

                return res.status(401).json({
                    message: "Invalid username or password."
                });

            }

            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!passwordMatch) {

                return res.status(401).json({
                    message: "Invalid username or password."
                });

            }

            const token = jwt.sign(
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
                message: "Login successful.",
                token: token,
                username: user.username
            });

        }
    );

});

module.exports = router;