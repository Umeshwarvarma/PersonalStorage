const path = require("node:path");
const sharp = require("sharp");
const { PDFDocument } = require("pdf-lib");

const MAX_COMPRESS_SIZE = 50 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;

const imageFormats = {
    ".jpg": "jpeg",
    ".jpeg": "jpeg",
    ".png": "png",
    ".webp": "webp"
};

const alreadyCompressedExtensions = new Set([
    ".zip",
    ".7z",
    ".rar",
    ".gz",
    ".bz2",
    ".xz",
    ".zst"
]);

const createCompressionError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const compressBuffer = async (input, originalName, quality) => {
    if (!Buffer.isBuffer(input) || input.length === 0) {
        throw createCompressionError("The original file is empty or unreadable.");
    }

    if (input.length > MAX_COMPRESS_SIZE) {
        throw createCompressionError(
            "Files larger than the 50 MB compression limit are not supported.",
            413
        );
    }

    const extension = path.extname(originalName).toLowerCase();

    if (alreadyCompressedExtensions.has(extension)) {
        throw createCompressionError(
            `${extension.slice(1).toUpperCase()} files are already compressed and usually cannot be reduced further. The original file has been preserved.`,
            422
        );
    }

    if (imageFormats[extension]) {
        let image;
        let metadata;

        try {
            image = sharp(input, {
                failOn: "error",
                limitInputPixels: MAX_IMAGE_PIXELS
            });
            metadata = await image.metadata();
        } catch (error) {
            throw createCompressionError(
                `The image could not be decoded safely: ${error.message}`,
                422
            );
        }

        if (metadata.format !== imageFormats[extension]) {
            throw createCompressionError(
                "The file contents do not match its image extension.",
                422
            );
        }

        let output;

        try {
            const orientedImage = image.rotate();
            output = imageFormats[extension] === "jpeg"
                ? await orientedImage.jpeg({
                    quality,
                    mozjpeg: true,
                    progressive: true
                }).toBuffer()
                : imageFormats[extension] === "png"
                    ? await orientedImage.png({
                        quality,
                        palette: true,
                        compressionLevel: 9,
                        effort: 8
                    }).toBuffer()
                    : await orientedImage.webp({ quality, effort: 6 }).toBuffer();
        } catch (error) {
            throw createCompressionError(
                `The image could not be compressed: ${error.message}`,
                422
            );
        }

        return {
            buffer: output,
            contentType: `image/${imageFormats[extension]}`,
            originalName
        };
    }

    if (extension === ".pdf") {
        try {
            const pdf = await PDFDocument.load(input, {
                updateMetadata: false
            });
            const output = await pdf.save({
                useObjectStreams: true,
                addDefaultPage: false
            });

            return {
                buffer: Buffer.from(output),
                contentType: "application/pdf",
                originalName
            };
        } catch (error) {
            throw createCompressionError(
                `The PDF could not be optimized. It may be invalid, encrypted, or use unsupported features: ${error.message}`,
                422
            );
        }
    }

    throw createCompressionError(
        "Compression supports JPG, JPEG, PNG, WebP, and PDF files. This file type is not supported."
    );
};

module.exports = {
    MAX_COMPRESS_SIZE,
    compressBuffer
};
