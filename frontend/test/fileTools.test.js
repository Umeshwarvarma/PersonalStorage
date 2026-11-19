import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { createPdfFromFiles } from "../src/fileTools.js";

const createTestFile = (name, contents, type = "") =>
    new File([contents], name, { type });

const assertPdfFile = async (file) => {
    assert.equal(file.type, "application/pdf");
    assert.equal(
        new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()),
        "%PDF-"
    );
};

test("TXT conversion creates a PDF without modifying the source", async () => {
    const source = createTestFile("notes.txt", "A line of notes", "text/plain");
    const pdf = await createPdfFromFiles([source]);

    await assertPdfFile(pdf);
    assert.equal(source.name, "notes.txt");
    assert.equal(await source.text(), "A line of notes");
});

test("DOCX conversion extracts document text into a PDF", async () => {
    const docx = new JSZip();
    docx.file(
        "[Content_Types].xml",
        `<?xml version="1.0" encoding="UTF-8"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        </Types>`
    );
    docx.file(
        "_rels/.rels",
        `<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
        </Relationships>`
    );
    docx.file(
        "word/document.xml",
        `<?xml version="1.0" encoding="UTF-8"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body><w:p><w:r><w:t>Word document content</w:t></w:r></w:p></w:body>
        </w:document>`
    );
    const source = createTestFile(
        "notes.docx",
        await docx.generateAsync({ type: "uint8array" }),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const pdf = await createPdfFromFiles([source]);

    await assertPdfFile(pdf);
});

test("image conversion creates a PDF and releases its image URL", async (t) => {
    const previousImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
    const previousCreateObjectUrl =
        Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const previousRevokeObjectUrl =
        Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    let revokedUrl;

    t.after(() => {
        for (const [target, key, descriptor] of [
            [globalThis, "Image", previousImage],
            [URL, "createObjectURL", previousCreateObjectUrl],
            [URL, "revokeObjectURL", previousRevokeObjectUrl]
        ]) {
            if (descriptor) {
                Object.defineProperty(target, key, descriptor);
            } else {
                delete target[key];
            }
        }
    });

    globalThis.Image = class {
        naturalWidth = 1;
        naturalHeight = 1;

        get src() {
            return this.imageUrl;
        }

        set src(value) {
            this.imageUrl = value;
            this.onload();
        }
    };
    URL.createObjectURL = () => "blob:image-test";
    URL.revokeObjectURL = (url) => {
        revokedUrl = url;
    };

    const pngBytes = Uint8Array.from(
        atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4XmP4z8DwHwAFAAH/NQZ7kgAAAABJRU5ErkJggg=="),
        (character) => character.charCodeAt(0)
    );
    const source = createTestFile("photo.png", pngBytes, "image/png");
    const pdf = await createPdfFromFiles([source]);

    await assertPdfFile(pdf);
    assert.equal(revokedUrl, "blob:image-test");
});

test("PDF conversion rejects unsupported formats with a helpful message", async () => {
    await assert.rejects(
        createPdfFromFiles([
            createTestFile("book.epub", "book", "application/epub+zip")
        ]),
        /is not supported.*JPG, JPEG, PNG, TXT, or DOCX/
    );
});

test("PDF conversion identifies existing PDFs", async () => {
    await assert.rejects(
        createPdfFromFiles([
            createTestFile("already.pdf", "%PDF-1.4", "application/pdf")
        ]),
        /already\.pdf.*already a PDF/
    );
});
