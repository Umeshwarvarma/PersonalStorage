const assert = require("node:assert/strict");
const { test } = require("node:test");
const sharp = require("sharp");
const { PDFDocument } = require("pdf-lib");

const { compressBuffer } = require("../compression");

test("compresses JPEG images at the selected quality and retains a valid image", async () => {
    const pixels = Buffer.alloc(512 * 512 * 3);

    for (let index = 0; index < pixels.length; index += 1) {
        pixels[index] = (index * 37 + Math.floor(index / 3) * 13) % 256;
    }

    const source = await sharp(pixels, {
        raw: { width: 512, height: 512, channels: 3 }
    }).jpeg({ quality: 95 }).toBuffer();
    const result = await compressBuffer(source, "photo.jpg", 40);
    const metadata = await sharp(result.buffer).metadata();

    assert.equal(result.contentType, "image/jpeg");
    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.width, 512);
    assert.ok(result.buffer.length < source.length);
});

test("optimizes PNG files and preserves their image format", async () => {
    const source = await sharp({
        create: {
            width: 80,
            height: 80,
            channels: 4,
            background: { r: 80, g: 120, b: 200, alpha: 1 }
        }
    }).png().toBuffer();
    const result = await compressBuffer(source, "photo.png", 75);

    assert.equal((await sharp(result.buffer).metadata()).format, "png");
});

test("compresses WebP images and preserves their image format", async () => {
    const source = await sharp({
        create: {
            width: 80,
            height: 80,
            channels: 3,
            background: { r: 80, g: 120, b: 200 }
        }
    }).webp({ quality: 95 }).toBuffer();
    const result = await compressBuffer(source, "photo.webp", 55);

    assert.equal((await sharp(result.buffer).metadata()).format, "webp");
});

test("re-saves PDFs as valid PDFs", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 200]);
    const source = Buffer.from(await pdf.save());
    const result = await compressBuffer(source, "document.pdf", 75);
    const reopened = await PDFDocument.load(result.buffer);

    assert.equal(result.contentType, "application/pdf");
    assert.equal(reopened.getPageCount(), 1);
});

test("explains that already-compressed ZIP files cannot be reduced", async () => {
    await assert.rejects(
        compressBuffer(Buffer.from("PK\u0003\u0004"), "archive.zip", 75),
        /already compressed.*original file has been preserved/i
    );
});

test("rejects unsupported file types and mismatched image contents", async () => {
    const pngWithWrongExtension = await sharp({
        create: {
            width: 2,
            height: 2,
            channels: 3,
            background: { r: 0, g: 0, b: 0 }
        }
    }).png().toBuffer();

    await assert.rejects(
        compressBuffer(Buffer.from("text"), "notes.txt", 75),
        /file type is not supported/i
    );
    await assert.rejects(
        compressBuffer(pngWithWrongExtension, "photo.jpg", 75),
        /contents do not match its image extension/i
    );
});
