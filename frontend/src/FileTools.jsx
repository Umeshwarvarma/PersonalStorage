import { useEffect, useState } from "react";
import { createPdfFromFiles } from "./fileTools.js";

const formatSize = (bytes) => {
    if (bytes < 1024) {
        return `${bytes} bytes`;
    }

    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
};

function FileTools({ onSaveFile }) {
    const [converterInputs, setConverterInputs] = useState([]);
    const [pdfOutput, setPdfOutput] = useState(null);
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => () => {
        if (pdfOutput?.previewUrl) {
            URL.revokeObjectURL(pdfOutput.previewUrl);
        }
    }, [pdfOutput]);

    const convertSelectedFiles = async () => {
        if (converterInputs.length === 0) {
            setMessage("Select one or more supported files to convert.");
            return;
        }

        setBusy(true);
        setMessage("Converting the selected files to PDF...");

        try {
            const file = await createPdfFromFiles(converterInputs);
            setPdfOutput({
                file,
                previewUrl: URL.createObjectURL(file)
            });
            setMessage(
                `PDF conversion complete. Output size: ${file.size.toLocaleString()} bytes (${formatSize(file.size)}). Conversion does not necessarily reduce file size.`
            );
        } catch (error) {
            console.error(error);
            setMessage(error.message || "Could not convert the selected files.");
        } finally {
            setBusy(false);
        }
    };

    const saveGeneratedFile = async () => {
        setSaving(true);

        try {
            await onSaveFile(pdfOutput.file);
            setMessage(`${pdfOutput.file.name} saved to PersonalStorage.`);
        } catch (error) {
            setMessage(error.message || "Could not save the file to PersonalStorage.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="file-tools upload-card">
            <h2>PDF Converter</h2>
            <div className="file-tools-panel" role="tabpanel" aria-label="PDF Converter">
                <p>Convert JPG, JPEG, PNG, TXT, and DOCX files into a PDF.</p>
                <label className="tool-label" htmlFor="pdf-converter-input">
                    Choose files to convert
                </label>
                <input
                    id="pdf-converter-input"
                    type="file"
                    accept=".jpg,.jpeg,.png,.txt,.docx"
                    multiple
                    onChange={(event) => {
                        setConverterInputs(Array.from(event.target.files || []));
                        setPdfOutput((previous) => {
                            if (previous?.previewUrl) {
                                URL.revokeObjectURL(previous.previewUrl);
                            }
                            return null;
                        });
                        setMessage("");
                    }}
                    disabled={busy || saving}
                />
                {converterInputs.length > 0 && (
                    <ul className="tool-file-list">
                        {converterInputs.map((file, index) => (
                            <li key={`${file.name}-${index}`}>
                                {file.name} ({formatSize(file.size)})
                            </li>
                        ))}
                    </ul>
                )}
                <p className="tool-note">
                    Multiple images are added as separate PDF pages. DOCX text is extracted into PDF pages; formatting and embedded images are not preserved. PDFs can also be combined.
                </p>
                <button
                    type="button"
                    className="upload-button"
                    onClick={convertSelectedFiles}
                    disabled={busy || saving || converterInputs.length === 0}
                >
                    {busy ? "Converting..." : "Convert to PDF"}
                </button>
                {pdfOutput && (
                    <div className="tool-output">
                        <p>PDF size: {pdfOutput.file.size.toLocaleString()} bytes ({formatSize(pdfOutput.file.size)})</p>
                        <iframe
                            className="pdf-preview"
                            src={pdfOutput.previewUrl}
                            title="Converted PDF preview"
                        />
                        <div className="tool-output-actions">
                            <a
                                className="upload-button download-file-button"
                                href={pdfOutput.previewUrl}
                                download={pdfOutput.file.name}
                            >
                                Download PDF
                            </a>
                            <button
                                type="button"
                                className="upload-button"
                                onClick={saveGeneratedFile}
                                disabled={saving || busy}
                            >
                                {saving ? "Saving..." : "Save PDF to PersonalStorage"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {message && <p className="message" role="status">{message}</p>}
        </section>
    );
}

export default FileTools;
