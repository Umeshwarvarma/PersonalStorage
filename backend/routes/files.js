const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const db = require("../database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();


// =====================================
// UPLOAD FOLDER
// =====================================

const uploadFolder = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
}


// =====================================
// MULTER STORAGE
// =====================================

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, uploadFolder);
    },

    filename: function (req, file, cb) {

        const extension = path.extname(file.originalname);

        const filename =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1000000) +
            extension;

        cb(null, filename);
    }
});


// =====================================
// MULTER
// =====================================

const upload = multer({

    storage: storage,

    limits: {
        fileSize: 50 * 1024 * 1024
    }

});


// =====================================
// UPLOAD FILE
// =====================================

router.post(
    "/upload",
    authenticateToken,
    upload.single("file"),
    (req, res) => {

        if (!req.file) {

            return res.status(400).json({
                message: "Please select a file."
            });

        }

        const sql = `
            INSERT INTO files
            (
                user_id,
                original_name,
                filename,
                mimetype,
                size
            )
            VALUES (?, ?, ?, ?, ?)
        `;

        db.run(
            sql,
            [
                req.user.id,
                req.file.originalname,
                req.file.filename,
                req.file.mimetype,
                req.file.size
            ],
            function (err) {

                if (err) {

                    console.error(err);

                    const filePath = path.join(
                        uploadFolder,
                        req.file.filename
                    );

                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }

                    return res.status(500).json({
                        message: "Could not save file."
                    });
                }

                res.status(201).json({

                    message: "File uploaded successfully.",

                    fileId: this.lastID

                });

            }
        );

    }
);


// =====================================
// GET ALL USER FILES
// =====================================

router.get(
    "/",
    authenticateToken,
    (req, res) => {

        const sql = `
            SELECT
                id,
                original_name,
                filename,
                mimetype,
                size,
                uploaded_at
            FROM files
            WHERE user_id = ?
            ORDER BY uploaded_at DESC
        `;

        db.all(
            sql,
            [req.user.id],
            (err, files) => {

                if (err) {

                    console.error(err);

                    return res.status(500).json({
                        message: "Could not load files."
                    });

                }

                res.json(files);

            }
        );

    }
);


// =====================================
// DOWNLOAD FILE
// =====================================

router.get(
    "/download/:id",
    authenticateToken,
    (req, res) => {

        const sql = `
            SELECT *
            FROM files
            WHERE id = ?
            AND user_id = ?
        `;

        db.get(
            sql,
            [
                req.params.id,
                req.user.id
            ],
            (err, file) => {

                if (err) {

                    return res.status(500).json({
                        message: "Database error."
                    });

                }

                if (!file) {

                    return res.status(404).json({
                        message: "File not found."
                    });

                }

                const filePath = path.join(
                    uploadFolder,
                    file.filename
                );

                if (!fs.existsSync(filePath)) {

                    return res.status(404).json({
                        message: "Physical file not found."
                    });

                }

                res.download(
                    filePath,
                    file.original_name
                );

            }
        );

    }
);


// =====================================
// DELETE FILE
// =====================================

router.delete(
    "/:id",
    authenticateToken,
    (req, res) => {

        const sql = `
            SELECT *
            FROM files
            WHERE id = ?
            AND user_id = ?
        `;

        db.get(
            sql,
            [
                req.params.id,
                req.user.id
            ],
            (err, file) => {

                if (err) {

                    return res.status(500).json({
                        message: "Database error."
                    });

                }

                if (!file) {

                    return res.status(404).json({
                        message: "File not found."
                    });

                }

                const filePath = path.join(
                    uploadFolder,
                    file.filename
                );

                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }

                db.run(
                    `
                    DELETE FROM files
                    WHERE id = ?
                    AND user_id = ?
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ],
                    (deleteErr) => {

                        if (deleteErr) {

                            return res.status(500).json({
                                message: "Could not delete file."
                            });

                        }

                        res.json({
                            message: "File deleted successfully."
                        });

                    }
                );

            }
        );

    }
);


// =====================================
// STORAGE INFORMATION
// =====================================

router.get(
    "/storage/info",
    authenticateToken,
    (req, res) => {

        const sql = `
            SELECT
                COUNT(*) AS fileCount,
                COALESCE(SUM(size), 0) AS totalSize
            FROM files
            WHERE user_id = ?
        `;

        db.get(
            sql,
            [req.user.id],
            (err, result) => {

                if (err) {

                    return res.status(500).json({
                        message: "Could not calculate storage."
                    });

                }

                res.json({
                    fileCount: result.fileCount,
                    totalSize: result.totalSize
                });

            }
        );

    }
);


// =====================================
// EXPORT ROUTER
// =====================================

module.exports = router;