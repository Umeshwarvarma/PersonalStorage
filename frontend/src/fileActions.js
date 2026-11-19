export const shareOriginalFiles = async (files) => {
    if (!Array.isArray(files) || files.length === 0) {
        throw new Error("Please select one or more files to share.");
    }

    const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files });

    if (canShareFiles) {
        await navigator.share({
            title: "Original files",
            files
        });

        return "shared";
    }

    files.forEach((file) => {
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    });

    return "downloaded";
};
