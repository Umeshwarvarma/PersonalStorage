import assert from "node:assert/strict";
import { test } from "node:test";
import { getFilePreviewKind } from "../src/filePreview.js";

test("supported images, PDF, and text files use browser previews", () => {
    for (const [name, mimetype, expectedKind] of [
        ["photo.jpg", "image/jpeg", "image"],
        ["photo.jpeg", "image/jpeg", "image"],
        ["photo.png", "image/png", "image"],
        ["animation.gif", "image/gif", "image"],
        ["photo.webp", "image/webp", "image"],
        ["report.pdf", "application/pdf", "pdf"],
        ["notes.txt", "text/plain", "text"]
    ]) {
        assert.equal(
            getFilePreviewKind({ original_name: name, mimetype }),
            expectedKind
        );
    }
});

test("supported media types use browser audio and video players", () => {
    assert.equal(
        getFilePreviewKind({
            original_name: "recording.mp3",
            mimetype: "audio/mpeg"
        }),
        "audio"
    );
    assert.equal(
        getFilePreviewKind({
            original_name: "clip.mp4",
            mimetype: "video/mp4"
        }),
        "video"
    );
});

test("unknown files and active text formats are not opened inline", () => {
    assert.equal(
        getFilePreviewKind({
            original_name: "archive.zip",
            mimetype: "application/zip"
        }),
        null
    );
    assert.equal(
        getFilePreviewKind({
            original_name: "page.html",
            mimetype: "text/html"
        }),
        null
    );
});

test("recognized file extensions recover previews for generic stored MIME types", () => {
    assert.equal(
        getFilePreviewKind({
            original_name: "legacy-image.png",
            mimetype: "application/octet-stream"
        }),
        "image"
    );
});
