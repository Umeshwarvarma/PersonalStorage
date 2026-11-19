const getExtension = (file) =>
    file.name.split(".").pop().toLowerCase();

const isPdf = (file) =>
    file.type === "application/pdf" || getExtension(file) === "pdf";

const isImage = (file) =>
    ["jpg", "jpeg", "png"].includes(getExtension(file));

const isConvertible = (file) =>
    isImage(file) ||
    ["txt", "docx"].includes(getExtension(file));

const bytesToBase64 = (bytes) => {
    let binary = "";
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(offset, offset + chunkSize)
        );
    }

    return btoa(binary);
};

const addTextToPdf = (pdf, text) => {
    const margin = 40;
    const lineHeight = 14;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const lines = pdf.splitTextToSize(text || " ", pageWidth - margin * 2);
    let cursorY = margin;

    lines.forEach((line) => {
        if (cursorY + lineHeight > pageHeight - margin) {
            pdf.addPage();
            cursorY = margin;
        }

        pdf.text(line, margin, cursorY);
        cursorY += lineHeight;
    });
};

export const createPdfFromFiles = async (files) => {
    if (!Array.isArray(files) || files.length === 0) {
        throw new Error("Select at least one file to convert to PDF.");
    }

    const existingPdf = files.find(isPdf);

    if (existingPdf) {
        throw new Error(`"${existingPdf.name}" is already a PDF.`);
    }

    const unsupported = files.find((file) => !isConvertible(file));

    if (unsupported) {
        throw new Error(
            `"${unsupported.name}" is not supported. Choose JPG, JPEG, PNG, TXT, or DOCX files.`
        );
    }

    let jsPDF;

    try {
        ({ jsPDF } = await import("jspdf"));
    } catch (error) {
        throw new Error(
            `PDF conversion is unavailable because the PDF generator could not be loaded: ${error.message}`,
            { cause: error }
        );
    }

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    let addedPage = false;

    for (const file of files) {
        if (isImage(file)) {
            const imageBytes = new Uint8Array(await file.arrayBuffer());
            const imageData =
                `data:${getExtension(file) === "png" ? "image/png" : "image/jpeg"};base64,` +
                bytesToBase64(imageBytes);
            const format = getExtension(file) === "png" ? "PNG" : "JPEG";
            const dimensions = await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => {
                    resolve({
                        width: image.naturalWidth,
                        height: image.naturalHeight
                    });
                    URL.revokeObjectURL(image.src);
                };
                image.onerror = () => {
                    URL.revokeObjectURL(image.src);
                    reject(new Error(`Could not read image "${file.name}".`));
                };
                image.src = URL.createObjectURL(file);
            });
            const pageWidth = Math.max(1, dimensions.width);
            const pageHeight = Math.max(1, dimensions.height);

            if (addedPage) {
                pdf.addPage([pageWidth, pageHeight]);
            } else {
                pdf.deletePage(1);
                pdf.addPage([pageWidth, pageHeight], "portrait");
            }

            pdf.addImage(imageData, format, 0, 0, pageWidth, pageHeight);
            addedPage = true;
            continue;
        }

        let text;

        if (getExtension(file) === "txt") {
            text = await file.text();
        } else {
            let mammoth;

            try {
                mammoth = await import("mammoth/mammoth.browser.js");
            } catch (error) {
                throw new Error(
                    `DOCX conversion is unavailable because its conversion library could not be loaded: ${error.message}`,
                    { cause: error }
                );
            }

            const result = await mammoth.extractRawText({
                arrayBuffer: await file.arrayBuffer()
            });
            text = result.value;
        }

        if (addedPage) {
            pdf.addPage();
        }

        addTextToPdf(pdf, text);
        addedPage = true;
    }

    if (!addedPage) {
        throw new Error("The selected files did not produce any PDF pages.");
    }

    return new File(
        [pdf.output("arraybuffer")],
        "converted-files.pdf",
        { type: "application/pdf" }
    );
};
