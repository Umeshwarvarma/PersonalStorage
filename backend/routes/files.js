const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const db = require("../database");
const { authenticateToken } = require("../middleware/auth");
const { MAX_COMPRESS_SIZE, compressBuffer } = require("../compression");

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

const resolveStoredFilePath = (filename) => {
    if (
        typeof filename !== "string" ||
        !filename ||
        path.basename(filename) !== filename
    ) {
        return null;
    }

    const filePath = path.resolve(uploadFolder, filename);
    const folderPath = path.resolve(uploadFolder);

    return filePath.startsWith(`${folderPath}${path.sep}`)
        ? filePath
        : null;
};

const getOriginalBasename = (originalName) =>
    String(originalName || "download")
        .replaceAll("\\", "/")
        .split("/")
        .filter(Boolean)
        .pop() || "download";

const getStoredMimeType = (file) => {
    const storedMimeType =
        typeof file.mimetype === "string" &&
        /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/.test(file.mimetype)
            ? file.mimetype.toLowerCase()
            : "";

    if (storedMimeType && storedMimeType !== "application/octet-stream") {
        return storedMimeType;
    }

    return (
        {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".csv": "text/csv",
            ".log": "text/plain",
            ".md": "text/markdown",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".ogg": "audio/ogg",
            ".m4a": "audio/mp4",
            ".aac": "audio/aac",
            ".weba": "audio/webm",
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".mov": "video/quicktime",
            ".m4v": "video/mp4"
        }[path.extname(getOriginalBasename(file.original_name)).toLowerCase()] ||
        "application/octet-stream"
    );
};

const getInlineMimeTypes = () => new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "text/markdown",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/aac",
    "audio/webm",
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime"
]);

const handleFileUpload = (req, res, next) => {

    upload.single("file")(req, res, (uploadError) => {

        if (!uploadError) {
            next();
            return;
        }

        console.error("File upload error:", uploadError);

        const statusCode =
            uploadError instanceof multer.MulterError &&
            uploadError.code === "LIMIT_FILE_SIZE"
                ? 413
                : 400;

        const message =
            statusCode === 413
                ? "File exceeds the 50 MB upload limit."
                : "Could not process the uploaded file.";

        if (req.file && req.file.filename) {
            const filePath = path.join(uploadFolder, req.file.filename);

            fs.unlink(filePath, (cleanupError) => {
                if (cleanupError && cleanupError.code !== "ENOENT") {
                    console.error("Could not clean up failed upload:", cleanupError);
                }

                res.status(statusCode).json({ message });
            });

            return;
        }

        res.status(statusCode).json({ message });

    });

};


// =====================================
// UPLOAD FILE
// =====================================

router.post(
    "/upload",
    authenticateToken,
    handleFileUpload,
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

                    fs.unlink(filePath, (cleanupError) => {
                        if (cleanupError && cleanupError.code !== "ENOENT") {
                            console.error(
                                "Could not clean up file after database failure:",
                                cleanupError
                            );
                        }

                        res.status(500).json({
                            message: "Could not save file."
                        });
                    });

                    return;
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
// VIEW FILE
// =====================================

router.get(
    "/view/:id",
    authenticateToken,
    (req, res) => {
        db.get(
            `
            SELECT original_name, filename, mimetype
            FROM files
            WHERE id = ?
            AND user_id = ?
            `,
            [req.params.id, req.user.id],
            (err, file) => {
                if (err) {
                    console.error("File view lookup failed:", err);
                    return res.status(500).json({
                        message: "Could not load file."
                    });
                }

                if (!file) {
                    return res.status(404).json({
                        message: "File not found."
                    });
                }

                const filePath = resolveStoredFilePath(file.filename);

                if (!filePath || !fs.existsSync(filePath)) {
                    return res.status(404).json({
                        message: "Physical file not found."
                    });
                }

                const mimeType = getStoredMimeType(file);
                const inline = getInlineMimeTypes().has(mimeType);
                const originalBasename = getOriginalBasename(file.original_name);
                const fallbackName = originalBasename.replace(/[^\x20-\x7E"\\]/g, "_");
                const encodedName = encodeURIComponent(
                    originalBasename
                ).replace(/['()*]/g, (character) =>
                    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
                );

                res.setHeader("Content-Type", mimeType);
                res.setHeader(
                    "Content-Disposition",
                    `${inline ? "inline" : "attachment"}; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`
                );
                res.setHeader("X-Content-Type-Options", "nosniff");

                const stream = fs.createReadStream(filePath);
                stream.on("error", (streamError) => {
                    console.error("Could not read file for viewing:", streamError);

                    if (!res.headersSent) {
                        res.status(500).json({
                            message: "Could not read the stored file."
                        });
                    } else {
                        res.destroy();
                    }
                });
                stream.pipe(res);
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
// COMPRESS FILE
// =====================================

router.post(
    "/compress/:id",
    authenticateToken,
    async (req, res) => {
        const quality = Number(req.body?.quality);

        if (!Number.isInteger(quality) || quality < 30 || quality > 95) {
            return res.status(400).json({
                message: "Image quality must be an integer from 30 to 95."
            });
        }

        db.get(
            `
            SELECT original_name, filename
            FROM files
            WHERE id = ?
            AND user_id = ?
            `,
            [req.params.id, req.user.id],
            async (lookupError, file) => {
                if (lookupError) {
                    console.error("File compression lookup failed:", lookupError);
                    return res.status(500).json({
                        message: "Could not load the original file."
                    });
                }

                if (!file) {
                    return res.status(404).json({
                        message: "File not found."
                    });
                }

                const filePath = resolveStoredFilePath(file.filename);

                if (!filePath) {
                    return res.status(404).json({
                        message: "Physical file not found."
                    });
                }

                try {
                    const fileStats = await fs.promises.stat(filePath);

                    if (fileStats.size > MAX_COMPRESS_SIZE) {
                        return res.status(413).json({
                            message: "Files larger than the 50 MB compression limit are not supported."
                        });
                    }

                    const input = await fs.promises.readFile(filePath);
                    const result = await compressBuffer(
                        input,
                        getOriginalBasename(file.original_name),
                        quality
                    );
                    const downloadName = `compressed-${getOriginalBasename(file.original_name)}`;
                    const fallbackName = downloadName.replace(/[^\x20-\x7E"\\]/g, "_");
                    const encodedName = encodeURIComponent(downloadName).replace(
                        /['()*]/g,
                        (character) =>
                            `%${character.charCodeAt(0).toString(16).toUpperCase()}`
                    );

                    res.setHeader("Content-Type", result.contentType);
                    res.setHeader(
                        "Content-Disposition",
                        `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`
                    );
                    res.setHeader("Content-Length", result.buffer.length);
                    res.setHeader("X-Original-Size", input.length);
                    res.setHeader("X-Content-Type-Options", "nosniff");
                    return res.send(result.buffer);
                } catch (compressionError) {
                    if (compressionError.code === "ENOENT") {
                        return res.status(404).json({
                            message: "Physical file not found."
                        });
                    }

                    if (compressionError.statusCode) {
                        return res.status(compressionError.statusCode).json({
                            message: compressionError.message
                        });
                    }

                    console.error("File compression failed:", compressionError);
                    return res.status(500).json({
                        message: "Could not compress the file. Please try again."
                    });
                }
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

                    console.error(err);

                    return res.status(500).json({
                        message: "Database error."
                    });
                }

                if (!file) {

                    return res.status(404).json({
                        message: "File record not found."
                    });
                }

                const filePath = path.join(
                    uploadFolder,
                    file.filename
                );

                // Delete physical file if it exists
                if (fs.existsSync(filePath)) {

                    try {
                        fs.unlinkSync(filePath);
                    } catch (deleteError) {

                        console.error(
                            "Physical file delete error:",
                            deleteError
                        );

                        if (deleteError.code !== "ENOENT") {
                            return res.status(500).json({
                                message: "Could not delete the physical file."
                            });
                        }
                    }
                }

                // Delete database record
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
                    function (deleteErr) {

                        if (deleteErr) {

                            console.error(deleteErr);

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