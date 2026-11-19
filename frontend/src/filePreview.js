const MIME_TYPES_BY_EXTENSION = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    log: "text/plain",
    md: "text/markdown",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    weba: "audio/webm",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    m4v: "video/mp4"
};

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp"
]);

export const getFilePreviewKind = (file) => {
    const storedMimeType = file?.mimetype?.toLowerCase();
    const extension = file?.original_name?.split(".").pop().toLowerCase();
    const mimeType =
        storedMimeType && storedMimeType !== "application/octet-stream"
            ? storedMimeType
            : MIME_TYPES_BY_EXTENSION[extension];

    if (SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
        return "image";
    }

    if (mimeType === "application/pdf") {
        return "pdf";
    }

    if (
        mimeType === "text/plain" ||
        mimeType === "text/csv" ||
        mimeType === "text/markdown"
    ) {
        return "text";
    }

    if (mimeType?.startsWith("audio/")) {
        return "audio";
    }

    if (mimeType?.startsWith("video/")) {
        return "video";
    }

    return null;
};
