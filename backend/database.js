const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const databasePath = path.resolve(
    process.env.DATABASE_PATH || path.join(__dirname, "personalstorage.db")
);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new sqlite3.Database(databasePath, (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("SQLite Database Connected");
    }
});

db.serialize(() => {

    // USERS TABLE
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT,
            password TEXT NOT NULL,
            reset_token TEXT,
            reset_token_expires INTEGER
        )
    `);

    // FILES TABLE
    db.run(`
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            original_name TEXT NOT NULL,
            filename TEXT NOT NULL,
            mimetype TEXT,
            size INTEGER,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Add email column to older databases if necessary
    db.all(
        `PRAGMA table_info(users)`,
        (err, columns) => {

            if (err) {
                console.error(err);
                return;
            }

            const hasEmail =
                columns.some(
                    column => column.name === "email"
                );

            const hasResetToken =
                columns.some(
                    column => column.name === "reset_token"
                );

            const hasResetExpiry =
                columns.some(
                    column => column.name === "reset_token_expires"
                );

            if (!hasEmail) {
                db.run(
                    `ALTER TABLE users ADD COLUMN email TEXT`
                );
            }

            if (!hasResetToken) {
                db.run(
                    `ALTER TABLE users ADD COLUMN reset_token TEXT`
                );
            }

            if (!hasResetExpiry) {
                db.run(
                    `ALTER TABLE users ADD COLUMN reset_token_expires INTEGER`
                );
            }
        }
    );
});

module.exports = db;