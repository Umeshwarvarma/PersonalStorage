import assert from "node:assert/strict";
import { test } from "node:test";
import { shareOriginalFiles } from "../src/fileActions.js";

const createTestFile = (name, contents) =>
    new File([contents], name);

test("original-file sharing sends the originals or downloads each one separately", async (t) => {
    const files = [
        createTestFile("photo.jpg", "photo data"),
        createTestFile("report.pdf", "document data")
    ];
    const originalDescriptors = new Map(
        ["navigator", "document", "window"].map((key) => [
            key,
            Object.getOwnPropertyDescriptor(globalThis, key)
        ])
    );
    const originalCreateObjectURL =
        Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    let sharedFiles;
    const downloadedNames = [];

    t.after(() => {
        for (const [key, descriptor] of originalDescriptors) {
            if (descriptor) {
                Object.defineProperty(globalThis, key, descriptor);
            } else {
                delete globalThis[key];
            }
        }

        if (originalCreateObjectURL) {
            Object.defineProperty(URL, "createObjectURL", originalCreateObjectURL);
        } else {
            delete URL.createObjectURL;
        }
    });

    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {
            canShare: ({ files: candidateFiles }) => candidateFiles === files,
            share: async (data) => {
                sharedFiles = data.files;
            }
        }
    });

    assert.equal(await shareOriginalFiles(files), "shared");
    assert.deepEqual(sharedFiles, files);

    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {
            canShare: () => false,
            share: async () => {
                throw new Error("Unsupported sharing must use the download fallback.");
            }
        }
    });
    Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: {
            body: { appendChild: () => {} },
            createElement: () => {
                const link = {
                    download: "",
                    click: () => downloadedNames.push(link.download),
                    remove: () => {}
                };

                return link;
            }
        }
    });
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { setTimeout: () => {} }
    });
    Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: () => "blob:original-file"
    });

    assert.equal(await shareOriginalFiles(files), "downloaded");
    assert.deepEqual(downloadedNames, files.map((file) => file.name));
});
