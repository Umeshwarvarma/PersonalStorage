import { useCallback, useEffect, useRef, useState } from "react";
import {
    Bell,
    Check,
    ChevronRight,
    Cloud,
    File,
    FileText,
    FolderOpen,
    HardDrive,
    Image as ImageIcon,
    LayoutDashboard,
    LockKeyhole,
    LogOut,
    Menu,
    Moon,
    Monitor,
    Palette,
    Search,
    Settings as SettingsIcon,
    Share2,
    Sparkles,
    Shrink,
    Sun,
    Upload,
    UserRound,
    X
} from "lucide-react";
import FileTools from "./FileTools.jsx";
import { getApiErrorMessage, readJsonResponse } from "./api.js";
import { shareOriginalFiles } from "./fileActions.js";
import { getFilePreviewKind } from "./filePreview.js";
import "./App.css";

// =====================================================
// BACKEND URL
const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const accentOptions = [
    { name: "Blue", value: "#536dfe" },
    { name: "Violet", value: "#845ef7" },
    { name: "Teal", value: "#0f9f92" },
    { name: "Rose", value: "#e04f7d" }
];

function StoredFileCard({
    file,
    formatSize,
    onView,
    onDownload,
    onDelete,
    onCompress,
    compressionDisabled
}) {
    const previewKind = getFilePreviewKind(file);
    const FileIcon = previewKind === "image"
        ? ImageIcon
        : ["pdf", "text"].includes(previewKind)
            ? FileText
            : File;
    const uploadedAt = file.uploaded_at
        ? new Date(file.uploaded_at).toLocaleDateString()
        : "Date unavailable";

    return (
        <article className="storage-file-card">
            <div className="storage-file-card-icon">
                <FileIcon size={20} aria-hidden="true" />
            </div>
            <div className="storage-file-card-content">
                <h3 title={file.original_name}>{file.original_name}</h3>
                <p>{formatSize(file.size)} <span>·</span> {uploadedAt}</p>
            </div>
            <div className="storage-file-card-actions">
                <button type="button" onClick={onView} aria-label={`View ${file.original_name}`}>
                    View
                </button>
                <button
                    type="button"
                    onClick={onDownload}
                    aria-label={`Download ${file.original_name}`}
                >
                    Download
                </button>
                {onCompress && (
                    <button
                        type="button"
                        onClick={onCompress}
                        disabled={compressionDisabled}
                        aria-label={`Compress ${file.original_name}`}
                    >
                        Compress
                    </button>
                )}
                <button
                    type="button"
                    className="storage-file-delete"
                    onClick={onDelete}
                    aria-label={`Delete ${file.original_name}`}
                >
                    Delete
                </button>
            </div>
        </article>
    );
}


// =====================================================
// APP
// =====================================================

function App() {

    // =================================================
    // AUTH
    // =================================================

    const [token, setToken] = useState(
        localStorage.getItem("token")
    );

    const [username, setUsername] = useState(
        localStorage.getItem("username") || ""
    );

    const [isRegister, setIsRegister] = useState(false);

    const [showForgotPassword, setShowForgotPassword] =
        useState(false);

    const [resetToken, setResetToken] = useState("");


    // =================================================
    // FORM
    // =================================================

    const [loginUsername, setLoginUsername] =
        useState("");

    const [loginPassword, setLoginPassword] =
        useState("");

    const [registerEmail, setRegisterEmail] =
        useState("");

    const [forgotEmail, setForgotEmail] =
        useState("");

    const [newPassword, setNewPassword] =
        useState("");


    // =================================================
    // FILES
    // =================================================

    const [files, setFiles] = useState([]);
    const [filePreview, setFilePreview] = useState(null);
    const previewRequestRef = useRef(null);
    const previewObjectUrlRef = useRef(null);

    const [selectedFile, setSelectedFile] =
        useState(null);

    const [shareFiles, setShareFiles] =
        useState([]);

    const [uploadProgress, setUploadProgress] =
        useState(0);

    const [uploading, setUploading] =
        useState(false);

    const [compressionJob, setCompressionJob] =
        useState(null);

    const [activePage, setActivePage] = useState("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [fileQuery, setFileQuery] = useState("");
    const [profileEmail, setProfileEmail] = useState("");
    const [profileForm, setProfileForm] = useState({
        username: localStorage.getItem("username") || "",
        email: ""
    });
    const [profileMessage, setProfileMessage] = useState("");
    const [profileBusy, setProfileBusy] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [settingsNewPassword, setSettingsNewPassword] = useState("");
    const [confirmSettingsPassword, setConfirmSettingsPassword] = useState("");
    const [passwordMessage, setPasswordMessage] = useState("");
    const [passwordBusy, setPasswordBusy] = useState(false);
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem("personalstorage.theme");
        return ["light", "dark", "system"].includes(savedTheme)
            ? savedTheme
            : "system";
    });
    const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
    const [accentColor, setAccentColor] = useState(() =>
        accentOptions.some(
            (option) =>
                option.value === localStorage.getItem("personalstorage.accent")
        )
            ? localStorage.getItem("personalstorage.accent")
            : "#536dfe"
    );
    const [notificationPreferences, setNotificationPreferences] = useState(() => {
        try {
            const saved = JSON.parse(
                localStorage.getItem("personalstorage.notifications") || "{}"
            );
            return {
                fileActivity: saved.fileActivity ?? true,
                storageUpdates: saved.storageUpdates ?? true,
                sharing: saved.sharing ?? true
            };
        } catch {
            return {
                fileActivity: true,
                storageUpdates: true,
                sharing: true
            };
        }
    });

    const effectiveTheme = theme === "system"
        ? systemPrefersDark ? "dark" : "light"
        : theme;

    const navigationItems = [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "my-files", label: "My Files", icon: FolderOpen },
        { id: "upload", label: "Upload Files", icon: Upload },
        { id: "compression", label: "Compression", icon: Shrink },
        { id: "pdf-converter", label: "PDF Converter", icon: FileText },
        { id: "shared-files", label: "Shared Files", icon: Share2 },
        { id: "settings", label: "Settings", icon: SettingsIcon }
    ];

    // =================================================
    // OTHER
    // =================================================

    const [message, setMessage] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const [storageInfo, setStorageInfo] =
        useState({
            fileCount: 0,
            totalSize: 0
        });


    // =================================================
    // CHECK RESET TOKEN FROM EMAIL LINK
    // =================================================

    useEffect(() => {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const tokenFromUrl =
            params.get("resetToken");

        if (tokenFromUrl) {

            setResetToken(
                tokenFromUrl
            );

        }

    }, []);


    // =================================================
    // LOGIN / REGISTER
    // =================================================

    const handleAuth = async (e) => {

        e.preventDefault();

        setMessage("");
        setLoading(true);

        const endpoint =
            isRegister
                ? "/api/auth/register"
                : "/api/auth/login";

        try {

            const response =
                await fetch(
                    API_BASE + endpoint,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            username:
                                loginUsername,

                            email:
                                registerEmail,

                            password:
                                loginPassword

                        })
                    }
                );


            const data = await readJsonResponse(response);


            if (!response.ok) {

                throw new Error(
                    data?.message ||
                    "Something went wrong."
                );

            }


            // REGISTER
            if (isRegister) {

                alert(
                    "Registration successful! Please login."
                );

                setIsRegister(false);

                setRegisterEmail("");

                setLoginPassword("");

                return;
            }

            if (typeof data?.token !== "string" || !data.username) {
                throw new Error("The server returned an invalid login response.");
            }

            // LOGIN

            localStorage.setItem(
                "token",
                data.token
            );

            localStorage.setItem(
                "username",
                data.username
            );

            setToken(data.token);

            setUsername(data.username);

            setLoginPassword("");

            setMessage(
                "Login successful."
            );

        } catch (error) {

            setMessage(
                getApiErrorMessage(error, "Something went wrong.")
            );

        } finally {

            setLoading(false);

        }

    };


    // =================================================
    // LOGOUT
    // =================================================

    const logout = () => {

        localStorage.removeItem(
            "token"
        );

        localStorage.removeItem(
            "username"
        );

        setToken(null);

        setUsername("");

        setFiles([]);
        setProfileEmail("");
        setProfileForm({ username: "", email: "" });
        setCompressionJob(null);
        setActivePage("dashboard");

    };


    // =================================================
    // FORGOT PASSWORD
    // =================================================

    const forgotPassword = async (e) => {

        e.preventDefault();

        setLoading(true);

        setMessage("");

        try {

            const response =
                await fetch(
                    API_BASE +
                    "/api/auth/forgot-password",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            email:
                                forgotEmail
                        })
                    }
                );


            const data = await readJsonResponse(response);


            if (!response.ok) {

                throw new Error(
                    data?.message ||
                    "Could not send reset email."
                );

            }


            setMessage(
                "If the email exists, a password reset link has been sent."
            );

        } catch (error) {

            setMessage(
                getApiErrorMessage(error, "Could not send reset email.")
            );

        } finally {

            setLoading(false);

        }

    };


    // =================================================
    // RESET PASSWORD
    // =================================================

    const resetPassword = async (e) => {

        e.preventDefault();

        setLoading(true);

        setMessage("");

        try {

            const response =
                await fetch(
                    API_BASE +
                    "/api/auth/reset-password",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            token:
                                resetToken,

                            newPassword:
                                newPassword

                        })
                    }
                );


            const data = await readJsonResponse(response);


            if (!response.ok) {

                throw new Error(
                    data?.message ||
                    "Password reset failed."
                );

            }


            alert(
                "Password reset successfully!"
            );


            setResetToken("");

            setNewPassword("");

            window.history.replaceState(
                {},
                document.title,
                window.location.pathname
            );

            setShowForgotPassword(false);

        } catch (error) {

            setMessage(
                getApiErrorMessage(error, "Password reset failed.")
            );

        } finally {

            setLoading(false);

        }

    };


    // =================================================
    // AUTH ERROR
    // =================================================

    const handleAuthError = useCallback((response) => {

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            localStorage.removeItem(
                "token"
            );

            localStorage.removeItem(
                "username"
            );

            setToken(null);

            setUsername("");

            alert(
                "Your session expired. Please login again."
            );

            return true;
        }

        return false;

    }, []);


    // =================================================
    // LOAD FILES
    // =================================================

    const loadFiles = useCallback(async () => {

        const currentToken =
            localStorage.getItem(
                "token"
            );

        if (!currentToken) {
            return;
        }


        try {

            const response =
                await fetch(
                    API_BASE +
                    "/api/files",
                    {
                        headers: {
                            Authorization:
                                `Bearer ${currentToken}`
                        }
                    }
                );


            if (
                handleAuthError(
                    response
                )
            ) {
                return;
            }


            const data = await readJsonResponse(response);


            if (!response.ok) {

                throw new Error(
                    data?.message ||
                    "Could not load files."
                );

            }


            if (!Array.isArray(data)) {
                throw new Error("The server returned an invalid file list.");
            }

            setFiles(data);

        } catch (error) {

            console.error(
                error
            );

            setMessage(
                getApiErrorMessage(error, "Could not load files.")
            );

        }

    }, [handleAuthError]);


    // =================================================
    // STORAGE INFO
    // =================================================

    const loadStorageInfo = useCallback(async () => {

            const currentToken =
                localStorage.getItem(
                    "token"
                );

            if (!currentToken) {
                return;
            }


            try {

                const response =
                    await fetch(
                        API_BASE +
                        "/api/files/storage/info",
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${currentToken}`
                            }
                        }
                    );


                if (
                    handleAuthError(
                        response
                    )
                ) {
                    return;
                }


                const data = await readJsonResponse(response);


                if (!response.ok) {
                    throw new Error(data?.message || "Could not calculate storage.");
                }

                if (
                    !Number.isFinite(Number(data?.fileCount)) ||
                    !Number.isFinite(Number(data?.totalSize))
                ) {
                    throw new Error("The server returned invalid storage information.");
                }

                setStorageInfo({

                    fileCount:
                        Number(data.fileCount),

                    totalSize:
                        Number(data.totalSize)

                });

            } catch (error) {

                console.error(error);
                setMessage(
                    getApiErrorMessage(error, "Could not calculate storage.")
                );

            }

        }, [handleAuthError]);

    const loadProfile = useCallback(async () => {
        const currentToken = localStorage.getItem("token");

        if (!currentToken) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/auth/profile`, {
                headers: {
                    Authorization: `Bearer ${currentToken}`
                }
            });

            if (handleAuthError(response)) {
                return;
            }

            const data = await readJsonResponse(response);

            if (!response.ok) {
                throw new Error(data?.message || "Could not load profile settings.");
            }

            if (!data?.username) {
                throw new Error("The server returned an invalid profile response.");
            }

            setUsername(data.username);
            setProfileEmail(data.email || "");
            setProfileForm({
                username: data.username,
                email: data.email || ""
            });
        } catch (error) {
            console.error("Profile settings request failed:", error);
            setProfileMessage(
                getApiErrorMessage(error, "Could not load profile settings.")
            );
        }
    }, [handleAuthError]);

    // =================================================
    // LOAD AFTER LOGIN
    // =================================================

    useEffect(() => {

        if (token) {

            loadFiles();

            loadStorageInfo();

            loadProfile();
        }

    }, [token, loadFiles, loadStorageInfo, loadProfile]);

    useEffect(() => {
        localStorage.setItem("personalstorage.theme", theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem("personalstorage.accent", accentColor);
    }, [accentColor]);

    useEffect(() => {
        localStorage.setItem(
            "personalstorage.notifications",
            JSON.stringify(notificationPreferences)
        );
    }, [notificationPreferences]);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const updateSystemTheme = (event) => setSystemPrefersDark(event.matches);

        setSystemPrefersDark(mediaQuery.matches);
        mediaQuery.addEventListener("change", updateSystemTheme);

        return () => {
            mediaQuery.removeEventListener("change", updateSystemTheme);
        };
    }, []);

    // =================================================
    // FILE SELECT
    // =================================================

    const clearUploadSelection = () => {
        setSelectedFile(null);
        setUploadProgress(0);

        const input = document.getElementById("fileInput");

        if (input) {
            input.value = "";
        }
    };

    const handleFileChange = (event) => {
        setSelectedFile(event.target.files?.[0] || null);
    };


    const uploadToApi = (file, bytesBefore, totalBytes) => {

        const currentToken = localStorage.getItem("token");

        if (!currentToken) {
            return Promise.reject(new Error("Please login again."));
        }

        return new Promise((resolve, reject) => {

            const formData = new FormData();
            formData.append("file", file, file.name);

            const request = new XMLHttpRequest();
            request.open("POST", `${API_BASE}/api/files/upload`);
            request.setRequestHeader(
                "Authorization",
                `Bearer ${currentToken}`
            );

            request.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const progress =
                        ((bytesBefore + event.loaded) / Math.max(totalBytes, 1)) * 100;

                    setUploadProgress(Math.min(100, Math.round(progress)));
                }
            };

            request.onload = () => {

                if (request.status === 401 || request.status === 403) {
                    handleAuthError({ status: request.status });
                }

                const data = (() => {
                    if (!request.responseText.trim()) {
                        return null;
                    }

                    try {
                        return JSON.parse(request.responseText);
                    } catch {
                        return null;
                    }
                })();

                if (request.status < 200 || request.status >= 300) {
                    reject(new Error(data?.message || "Upload failed."));
                    return;
                }

                if (!data || typeof data.fileId !== "number") {
                    reject(new Error("The server returned an invalid upload response."));
                    return;
                }

                resolve(data);

            };

            request.onerror = () => {
                reject(new Error("Upload failed because of a network error."));
            };

            request.send(formData);

        });

    };


    const saveGeneratedFile = async (file) => {
        const maxFileSize = 50 * 1024 * 1024;

        if (file.size > maxFileSize) {
            throw new Error(`${file.name} exceeds the 50 MB upload limit.`);
        }

        await uploadToApi(file, 0, file.size);
        await loadFiles();
        await loadStorageInfo();
    };


    const shareSelectedOriginalFiles = async () => {
        setLoading(true);

        try {
            const result = await shareOriginalFiles(shareFiles);

            setMessage(
                result === "shared"
                    ? `Shared ${shareFiles.length} original file(s).`
                    : `File sharing is not supported for this selection. Started individual downloads for ${shareFiles.length} original file(s); allow multiple downloads if your browser asks.`
            );
        } catch (error) {
            setMessage(
                error.name === "AbortError"
                    ? "Sharing was canceled."
                    : error.message || "Could not share the original files."
            );
        } finally {
            setLoading(false);
        }
    };

    const saveProfileSettings = async (event) => {
        event.preventDefault();
        setProfileBusy(true);
        setProfileMessage("");

        try {
            const currentToken = localStorage.getItem("token");
            const response = await fetch(`${API_BASE}/api/auth/profile`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${currentToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(profileForm)
            });

            if (handleAuthError(response)) {
                return;
            }

            const data = await readJsonResponse(response);

            if (!response.ok) {
                throw new Error(data?.message || "Could not save profile settings.");
            }

            if (!data?.username || typeof data.email !== "string") {
                throw new Error("The server returned an invalid profile response.");
            }

            setUsername(data.username);
            setProfileEmail(data.email);
            setProfileForm({
                username: data.username,
                email: data.email
            });
            localStorage.setItem("username", data.username);
            setProfileMessage("Profile settings saved.");
        } catch (error) {
            setProfileMessage(
                getApiErrorMessage(error, "Could not save profile settings.")
            );
        } finally {
            setProfileBusy(false);
        }
    };

    const savePasswordSettings = async (event) => {
        event.preventDefault();
        setPasswordMessage("");

        if (settingsNewPassword !== confirmSettingsPassword) {
            setPasswordMessage("The new passwords do not match.");
            return;
        }

        setPasswordBusy(true);

        try {
            const currentToken = localStorage.getItem("token");
            const response = await fetch(
                `${API_BASE}/api/auth/change-password`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${currentToken}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        currentPassword,
                        newPassword: settingsNewPassword
                    })
                }
            );

            if (handleAuthError(response)) {
                return;
            }

            const data = await readJsonResponse(response);

            if (!response.ok) {
                throw new Error(data?.message || "Could not update the password.");
            }

            setCurrentPassword("");
            setSettingsNewPassword("");
            setConfirmSettingsPassword("");
            setPasswordMessage("Password updated successfully.");
        } catch (error) {
            setPasswordMessage(
                getApiErrorMessage(error, "Could not update the password.")
            );
        } finally {
            setPasswordBusy(false);
        }
    };

    const navigateTo = (page) => {
        setActivePage(page);
        setSidebarOpen(false);
        setNotificationsOpen(false);
    };

    const updateNotificationPreference = (preference, checked) => {
        setNotificationPreferences((current) => ({
            ...current,
            [preference]: checked
        }));
    };


    // =================================================
    // UPLOAD
    // =================================================

    const uploadFile = async () => {
        if (!selectedFile) {
            setMessage("Please select a file.");
            return;
        }

        setLoading(true);
        setUploading(true);
        setUploadProgress(0);

        try {
            const maxFileSize = 50 * 1024 * 1024;

            if (selectedFile.size > maxFileSize) {
                throw new Error(`${selectedFile.name} exceeds the 50 MB upload limit.`);
            }

            setMessage("Uploading...");
            await uploadToApi(selectedFile, 0, selectedFile.size);
            setMessage("File uploaded successfully.");
            clearUploadSelection();
            await loadFiles();
            await loadStorageInfo();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    const selectFileForCompression = (file) => {
        setCompressionJob({
            file,
            quality: 75,
            status: "ready"
        });
    };

    const compressSelectedFile = async () => {
        if (!compressionJob || compressionJob.status === "running") {
            return;
        }

        const { file, quality } = compressionJob;
        setCompressionJob((current) => ({
            ...current,
            status: "running",
            error: ""
        }));

        try {
            const currentToken = localStorage.getItem("token");

            if (!currentToken) {
                throw new Error("Please login again.");
            }

            const response = await fetch(
                `${API_BASE}/api/files/compress/${encodeURIComponent(file.id)}`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${currentToken}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ quality })
                }
            );

            if (handleAuthError(response)) {
                throw new Error("Your session expired. Please login again.");
            }

            if (!response.ok) {
                const data = await readJsonResponse(response);
                throw new Error(data?.message || "Compression failed.");
            }

            const compressedFile = await response.blob();
            const responseType = response.headers.get("Content-Type") || "";
            if (
                !compressedFile.size ||
                responseType.includes("application/json") ||
                responseType.includes("text/html")
            ) {
                throw new Error("The server returned an invalid compressed file.");
            }
            const originalSizeHeader = response.headers.get("X-Original-Size");
            const parsedOriginalSize = Number(originalSizeHeader);
            const originalSize = originalSizeHeader === null ||
                !Number.isFinite(parsedOriginalSize) ||
                parsedOriginalSize < 0
                ? file.size
                : parsedOriginalSize;

            setCompressionJob((current) => ({
                ...current,
                status: "success",
                originalSize,
                compressedFile
            }));
        } catch (error) {
            setCompressionJob((current) => ({
                ...current,
                status: "error",
                error: getApiErrorMessage(error, "Could not compress the file.")
            }));
        }
    };

    const downloadCompressedFile = () => {
        if (!compressionJob?.compressedFile) {
            return;
        }

        const objectUrl = URL.createObjectURL(compressionJob.compressedFile);
        const link = document.createElement("a");
        const originalName = compressionJob.file.original_name
            .replaceAll("\\", "/")
            .split("/")
            .pop();

        link.href = objectUrl;
        link.download = `compressed-${originalName}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    };

    const returnToFileList = () => {
        setCompressionJob(null);
        setActivePage("my-files");
    };


    // =================================================
    // VIEW FILE
    // =================================================

    const releaseFilePreviewResources = () => {
        previewRequestRef.current?.abort();
        previewRequestRef.current = null;

        if (previewObjectUrlRef.current) {
            URL.revokeObjectURL(previewObjectUrlRef.current);
            previewObjectUrlRef.current = null;
        }
    };

    const closeFilePreview = () => {
        releaseFilePreviewResources();
        setFilePreview(null);
    };

    useEffect(() => () => {
        previewRequestRef.current?.abort();
        if (previewObjectUrlRef.current) {
            URL.revokeObjectURL(previewObjectUrlRef.current);
        }
    }, []);

    useEffect(() => {
        if (!filePreview) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === "Escape") {
                previewRequestRef.current?.abort();
                previewRequestRef.current = null;

                if (previewObjectUrlRef.current) {
                    URL.revokeObjectURL(previewObjectUrlRef.current);
                    previewObjectUrlRef.current = null;
                }

                setFilePreview(null);
            }
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [filePreview]);

    const viewFile = async (file) => {
        releaseFilePreviewResources();
        const previewKind = getFilePreviewKind(file);

        if (!Number.isSafeInteger(Number(file.id)) || Number(file.id) <= 0) {
            setFilePreview({ file, kind: previewKind, status: "error", message: "This file has an invalid ID. Refresh your file list and try again." });
            return;
        }

        if (!previewKind) {
            setFilePreview({
                file,
                kind: null,
                status: "unavailable",
                message: `Preview is unavailable for "${file.original_name}". Download it to open it with a compatible application.`
            });
            return;
        }

        const controller = new AbortController();
        previewRequestRef.current = controller;
        setFilePreview({ file, kind: previewKind, status: "loading", message: "" });

        try {
            const currentToken = localStorage.getItem("token");
            if (!currentToken) {
                setFilePreview((current) => current?.file.id === file.id
                    ? { ...current, status: "error", message: "You are signed out. Sign in again to preview this file." }
                    : current);
                return;
            }

            const response = await fetch(
                API_BASE + "/api/files/view/" + encodeURIComponent(file.id),
                {
                    headers: { Authorization: "Bearer " + currentToken },
                    signal: controller.signal
                }
            );

            if (previewRequestRef.current !== controller) return;
            if (response.status === 401 || response.status === 403) {
                handleAuthError(response);
                setFilePreview((current) => current?.file.id === file.id
                    ? {
                        ...current,
                        status: "error",
                        message: response.status === 401
                            ? "Your session expired. Sign in again to preview this file."
                            : "You are not authorized to preview this file."
                    }
                    : current);
                return;
            }

            if (!response.ok) {
                const data = await readJsonResponse(response);
                const errorMessage = response.status === 404
                    ? "This file could not be found. It may have been deleted or may not belong to your account."
                    : response.status >= 500
                        ? "The server could not load this file. Try again later."
                        : data?.message || "Preview request failed (" + response.status + ").";
                setFilePreview((current) => current?.file.id === file.id
                    ? { ...current, status: "error", message: errorMessage }
                    : current);
                return;
            }

            const disposition = response.headers.get("Content-Disposition") || "";
            const contentType = (response.headers.get("Content-Type") || "")
                .split(";")[0].trim().toLowerCase();
            if (!/^inline(?:;|$)/i.test(disposition)) {
                setFilePreview((current) => current?.file.id === file.id
                    ? { ...current, status: "unavailable", message: "The server did not return this file for inline preview. You can download it instead." }
                    : current);
                return;
            }

            const responseKind = getFilePreviewKind({
                original_name: file.original_name,
                mimetype: contentType
            });
            if (!responseKind || responseKind !== previewKind) {
                setFilePreview((current) => current?.file.id === file.id
                    ? {
                        ...current,
                        status: "unavailable",
                        message: "The server returned an unsupported content type (" + (contentType || "unknown") + "). Download the file to open it instead."
                    }
                    : current);
                return;
            }

            const blob = await response.blob();
            if (previewRequestRef.current !== controller) return;
            if (blob.size === 0) {
                setFilePreview((current) => current?.file.id === file.id
                    ? { ...current, status: "error", message: "The server returned an empty file." }
                    : current);
                return;
            }

            if (previewKind === "text") {
                const text = await blob.text();
                if (previewRequestRef.current !== controller) return;
                setFilePreview((current) => current?.file.id === file.id
                    ? { ...current, status: "ready", text, contentType }
                    : current);
                return;
            }

            const objectUrl = URL.createObjectURL(blob);
            previewObjectUrlRef.current = objectUrl;
            setFilePreview((current) => current?.file.id === file.id
                ? { ...current, status: "ready", url: objectUrl, contentType }
                : current);
        } catch (error) {
            if (error.name === "AbortError") return;
            console.error("File preview request failed:", error);
            setFilePreview((current) => current?.file.id === file.id
                ? { ...current, status: "error", message: "Could not retrieve this file. Check your connection and try again." }
                : current);
        } finally {
            if (previewRequestRef.current === controller) {
                previewRequestRef.current = null;
            }
        }
    };


    // =================================================
    // DOWNLOAD FILE
    // =================================================

    const downloadFile =
        async (file) => {

            const currentToken =
                localStorage.getItem(
                    "token"
                );


            try {

                const response =
                    await fetch(
                        `${API_BASE}/api/files/download/${file.id}`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${currentToken}`
                            }
                        }
                    );


                if (
                    handleAuthError(
                        response
                    )
                ) {
                    return;
                }


                if (!response.ok) {

                    const data = await readJsonResponse(response);

                    throw new Error(
                        data?.message ||
                        "Download failed."
                    );

                }


                const blob =
                    await response.blob();

                const url =
                    URL.createObjectURL(
                        blob
                    );


                const link =
                    document.createElement(
                        "a"
                    );

                link.href = url;

                link.download =
                    file.original_name;

                document.body.appendChild(
                    link
                );

                link.click();

                link.remove();

                window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

            } catch (error) {

                alert(getApiErrorMessage(error, "Download failed."));

            }

        };


    // =================================================
    // DELETE FILE
    // =================================================

    const deleteFile =
        async (fileId) => {

            const currentToken =
                localStorage.getItem(
                    "token"
                );


            const confirmed =
                window.confirm(
                    "Are you sure you want to delete this file?"
                );


            if (!confirmed) {
                return;
            }


            try {

                const response =
                    await fetch(
                        `${API_BASE}/api/files/${fileId}`,
                        {
                            method: "DELETE",

                            headers: {
                                Authorization:
                                    `Bearer ${currentToken}`
                            }
                        }
                    );


                if (
                    handleAuthError(
                        response
                    )
                ) {
                    return;
                }


                const data = await readJsonResponse(response);


                if (!response.ok) {

                    throw new Error(
                        data?.message ||
                        "Delete failed."
                    );

                }


                setFiles(
                    previous =>
                        previous.filter(
                            file =>
                                file.id !==
                                fileId
                        )
                );


                await loadStorageInfo();


                setMessage(
                    "File deleted successfully."
                );

            } catch (error) {

                alert(getApiErrorMessage(error, "Delete failed."));

            }

        };


    // =================================================
    // FORMAT SIZE
    // =================================================

    const formatSize =
        (bytes) => {

            if (
                !bytes ||
                bytes === 0
            ) {
                return "0 Bytes";
            }


            const units = [
                "Bytes",
                "KB",
                "MB",
                "GB"
            ];


            const index =
                Math.floor(
                    Math.log(bytes) /
                    Math.log(1024)
                );


            return (
                (
                    bytes /
                    Math.pow(
                        1024,
                        index
                    )
                ).toFixed(2)
                +
                " "
                +
                units[index]
            );

        };


    // =================================================
    // RESET PASSWORD PAGE
    // =================================================

    if (resetToken) {

        return (

            <div className="app">

                <div className="auth-container">

                    <div className="auth-card">

                        <h1>
                            Reset Password
                        </h1>

                        <p>
                            Enter your new password.
                        </p>


                        <form
                            onSubmit={
                                resetPassword
                            }
                        >

                            <label>
                                New Password
                            </label>

                            <input
                                type="password"
                                placeholder="New password"
                                value={
                                    newPassword
                                }
                                onChange={
                                    e =>
                                        setNewPassword(
                                            e.target.value
                                        )
                                }
                                minLength={6}
                                required
                            />


                            <button
                                type="submit"
                                disabled={
                                    loading
                                }
                            >
                                {loading
                                    ? "Resetting..."
                                    : "Reset Password"}
                            </button>

                        </form>


                        {message && (

                            <p className="message">
                                {message}
                            </p>

                        )}

                    </div>

                </div>

            </div>

        );

    }


    // =================================================
    // FORGOT PASSWORD PAGE
    // =================================================

    if (
        !token &&
        showForgotPassword
    ) {

        return (

            <div className="app">

                <div className="auth-container">

                    <div className="auth-card">

                        <h1>
                            Forgot Password?
                        </h1>

                        <p>
                            Enter the email connected
                            to your account.
                        </p>


                        <form
                            onSubmit={
                                forgotPassword
                            }
                        >

                            <label>
                                Email
                            </label>

                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={
                                    forgotEmail
                                }
                                onChange={
                                    e =>
                                        setForgotEmail(
                                            e.target.value
                                        )
                                }
                                required
                            />


                            <button
                                type="submit"
                                disabled={
                                    loading
                                }
                            >
                                {loading
                                    ? "Sending..."
                                    : "Send Reset Link"}
                            </button>

                        </form>


                        {message && (

                            <p className="message">
                                {message}
                            </p>

                        )}


                        <button
                            type="button"
                            className="link-button"
                            onClick={() => {

                                setShowForgotPassword(
                                    false
                                );

                                setMessage("");

                            }}
                        >
                            ← Back to Login
                        </button>

                    </div>

                </div>

            </div>

        );

    }


    // =================================================
    // LOGIN / REGISTER PAGE
    // =================================================

    if (!token) {

        return (

            <div className="app">

                <div className="auth-container">

                    <div className="auth-card">

                        <h1>
                            Personal Storage
                        </h1>

                        <p>
                            Store your files securely
                        </p>


                        <form
                            onSubmit={
                                handleAuth
                            }
                        >

                            <label>
                                Username
                            </label>

                            <input
                                type="text"
                                placeholder="Enter username"
                                value={
                                    loginUsername
                                }
                                onChange={
                                    e =>
                                        setLoginUsername(
                                            e.target.value
                                        )
                                }
                                required
                            />


                            {isRegister && (

                                <>
                                    <label>
                                        Email
                                    </label>

                                    <input
                                        type="email"
                                        placeholder="Enter email"
                                        value={
                                            registerEmail
                                        }
                                        onChange={
                                            e =>
                                                setRegisterEmail(
                                                    e.target.value
                                                )
                                        }
                                        required
                                    />
                                </>

                            )}


                            <label>
                                Password
                            </label>

                            <input
                                type="password"
                                placeholder="Enter password"
                                value={
                                    loginPassword
                                }
                                onChange={
                                    e =>
                                        setLoginPassword(
                                            e.target.value
                                        )
                                }
                                minLength={6}
                                required
                            />


                            <button
                                type="submit"
                                disabled={
                                    loading
                                }
                            >

                                {loading
                                    ? "Please wait..."
                                    : isRegister
                                        ? "Create Account"
                                        : "Login"}

                            </button>

                        </form>


                        {message && (

                            <p className="message">
                                {message}
                            </p>

                        )}


                        {!isRegister && (

                            <button
                                type="button"
                                className="link-button"
                                onClick={() => {

                                    setShowForgotPassword(
                                        true
                                    );

                                    setMessage("");

                                }}
                            >
                                Forgot Password?
                            </button>

                        )}


                        <p>

                            {isRegister
                                ? "Already have an account?"
                                : "Don't have an account?"}


                            <button
                                type="button"
                                className="link-button"
                                onClick={() => {

                                    setIsRegister(
                                        !isRegister
                                    );

                                    setMessage("");

                                }}
                            >

                                {isRegister
                                    ? " Login"
                                    : " Create Account"}

                            </button>

                        </p>

                    </div>

                </div>

            </div>

        );

    }


    const pageTitle =
        navigationItems.find((item) => item.id === activePage)?.label || "Dashboard";
    const filteredFiles = files.filter((file) =>
        file.original_name.toLowerCase().includes(fileQuery.trim().toLowerCase())
    );
    const compressionSavedBytes = compressionJob?.status === "success"
        ? compressionJob.originalSize - compressionJob.compressedFile.size
        : 0;
    const compressionReduction = compressionJob?.status === "success" &&
        compressionJob.originalSize > 0
        ? (compressionSavedBytes / compressionJob.originalSize) * 100
        : 0;
    const compressionSavedSize =
        `${compressionSavedBytes < 0 ? "-" : ""}${formatSize(Math.abs(compressionSavedBytes))}`;

    const renderFileCard = (file, allowCompression = true) => (
        <StoredFileCard
            key={file.id}
            file={file}
            formatSize={formatSize}
            onView={() => viewFile(file)}
            onDownload={() => downloadFile(file)}
            onDelete={() => deleteFile(file.id)}
            onCompress={allowCompression
                ? () => selectFileForCompression(file)
                : undefined}
            compressionDisabled={compressionJob?.status === "running"}
        />
    );

    const renderCompressionStatus = () => compressionJob && (
        <section
            className="panel-card compression-status"
            aria-labelledby="compression-status-title"
        >
            <div className="panel-heading">
                <div>
                    <p className="eyebrow">File optimization</p>
                    <h2 id="compression-status-title">Compression Status</h2>
                </div>
                {compressionJob.status === "success" && (
                    <span className="status-pill status-pill-success">
                        <Check size={15} aria-hidden="true" />
                        Complete
                    </span>
                )}
            </div>
            <dl className="compression-details">
                <div>
                    <dt>Original filename</dt>
                    <dd>{compressionJob.file.original_name}</dd>
                </div>
                <div>
                    <dt>Original size</dt>
                    <dd>{formatSize(
                        compressionJob.originalSize ?? compressionJob.file.size
                    )}</dd>
                </div>
                {/\.(jpe?g|png|webp)$/i.test(compressionJob.file.original_name) ? (
                    <div className="compression-quality-control">
                        <dt>
                            <label htmlFor="compression-quality">Image quality</label>
                        </dt>
                        <dd>
                            <input
                                id="compression-quality"
                                type="range"
                                min="30"
                                max="95"
                                step="5"
                                value={compressionJob.quality}
                                onChange={(event) =>
                                    setCompressionJob((current) => ({
                                        ...current,
                                        quality: Number(event.target.value)
                                    }))
                                }
                                disabled={!["ready", "error"].includes(compressionJob.status)}
                            />
                            <span>{compressionJob.quality}%</span>
                        </dd>
                    </div>
                ) : /\.pdf$/i.test(compressionJob.file.original_name) ? (
                    <div>
                        <dt>Optimization</dt>
                        <dd>PDF object-stream optimization</dd>
                    </div>
                ) : null}
            </dl>
            {compressionJob.status === "ready" && (
                <button
                    type="button"
                    className="button button-primary"
                    onClick={compressSelectedFile}
                >
                    <Shrink size={17} aria-hidden="true" />
                    Compress file
                </button>
            )}
            {compressionJob.status === "running" && (
                <div className="compression-running" role="status">
                    <span className="preview-spinner" aria-hidden="true" />
                    <strong>Compressing...</strong>
                </div>
            )}
            {compressionJob.status === "error" && (
                <div className="compression-error" role="alert">
                    <strong>Compression failed</strong>
                    <p>{compressionJob.error}</p>
                    <div className="button-row">
                        <button
                            type="button"
                            className="button button-primary"
                            onClick={compressSelectedFile}
                        >
                            Retry
                        </button>
                        <button
                            type="button"
                            className="button button-secondary"
                            onClick={returnToFileList}
                        >
                            Return to file list
                        </button>
                    </div>
                </div>
            )}
            {compressionJob.status === "success" && (
                <div className="compression-result" role="status">
                    <h3>
                        <Check size={18} aria-hidden="true" />
                        Compression completed
                    </h3>
                    <dl className="compression-details">
                        <div>
                            <dt>Original size</dt>
                            <dd>{formatSize(compressionJob.originalSize)}</dd>
                        </div>
                        <div>
                            <dt>Compressed size</dt>
                            <dd>{formatSize(compressionJob.compressedFile.size)}</dd>
                        </div>
                        <div>
                            <dt>Space saved</dt>
                            <dd>{compressionSavedSize}</dd>
                        </div>
                        <div>
                            <dt>Percentage reduction</dt>
                            <dd>{compressionReduction.toFixed(2)}%</dd>
                        </div>
                    </dl>
                    {compressionSavedBytes <= 0 && (
                        <p className="compression-warning">
                            Compression did not reduce the file size. The original file has been preserved.
                        </p>
                    )}
                    <div className="button-row">
                        <button
                            type="button"
                            className="button button-primary"
                            onClick={downloadCompressedFile}
                        >
                            Download compressed file
                        </button>
                        <button
                            type="button"
                            className="button button-secondary"
                            onClick={returnToFileList}
                        >
                            Return to file list
                        </button>
                    </div>
                </div>
            )}
        </section>
    );

    return (
        <div
            className="app-shell"
            data-theme={effectiveTheme}
            style={{ "--accent-color": accentColor }}
        >
            {sidebarOpen && (
                <button
                    type="button"
                    className="sidebar-backdrop"
                    aria-label="Close navigation"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
                <button
                    type="button"
                    className="sidebar-brand"
                    onClick={() => navigateTo("dashboard")}
                    aria-label="PersonalStorage dashboard"
                >
                    <span className="brand-mark">
                        <Cloud size={21} aria-hidden="true" />
                    </span>
                    <span>PersonalStorage</span>
                </button>

                <div className="sidebar-label">Workspace</div>
                <nav className="sidebar-navigation" aria-label="Main navigation">
                    {navigationItems.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            className={`nav-item${activePage === id ? " nav-item-active" : ""}`}
                            aria-current={activePage === id ? "page" : undefined}
                            onClick={() => navigateTo(id)}
                        >
                            <Icon size={18} aria-hidden="true" />
                            <span>{label}</span>
                            {id === "my-files" && files.length > 0 && (
                                <span className="nav-item-count">{files.length}</span>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-storage-note">
                        <div className="sidebar-storage-icon">
                            <HardDrive size={17} aria-hidden="true" />
                        </div>
                        <div>
                            <strong>{formatSize(storageInfo.totalSize)} used</strong>
                            <span>Capacity not configured</span>
                        </div>
                    </div>
                    <button type="button" className="nav-item logout-nav" onClick={logout}>
                        <LogOut size={18} aria-hidden="true" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            <div className="workspace">
                <header className="workspace-topbar">
                    <div className="topbar-leading">
                        <button
                            type="button"
                            className="icon-button mobile-menu-button"
                            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
                            onClick={() => setSidebarOpen((open) => !open)}
                        >
                            {sidebarOpen
                                ? <X size={20} aria-hidden="true" />
                                : <Menu size={20} aria-hidden="true" />}
                        </button>
                        <div className="breadcrumb">
                            <span>Workspace</span>
                            <ChevronRight size={14} aria-hidden="true" />
                            <strong>{pageTitle}</strong>
                        </div>
                    </div>
                    <div className="topbar-trailing">
                        <div className="notification-wrap">
                            <button
                                type="button"
                                className="icon-button"
                                aria-label="Notifications"
                                aria-expanded={notificationsOpen}
                                onClick={() => setNotificationsOpen((open) => !open)}
                            >
                                <Bell size={19} aria-hidden="true" />
                            </button>
                            {notificationsOpen && (
                                <div className="notification-popover">
                                    <div className="notification-popover-heading">
                                        <strong>Notifications</strong>
                                        <button
                                            type="button"
                                            className="icon-button small-icon-button"
                                            aria-label="Close notifications"
                                            onClick={() => setNotificationsOpen(false)}
                                        >
                                            <X size={16} aria-hidden="true" />
                                        </button>
                                    </div>
                                    <p>You’re all caught up.</p>
                                    <button
                                        type="button"
                                        className="text-button"
                                        onClick={() => navigateTo("settings")}
                                    >
                                        Manage notification preferences
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className="profile-chip"
                            onClick={() => navigateTo("settings")}
                            aria-label="Open profile settings"
                        >
                            <span className="profile-avatar">
                                {(username || "U").slice(0, 1).toUpperCase()}
                            </span>
                            <span className="profile-chip-text">
                                <strong>{username}</strong>
                                <small>{profileEmail || "Personal account"}</small>
                            </span>
                        </button>
                    </div>
                </header>

                <main className="workspace-content">
                    {activePage === "dashboard" && (
                        <div className="page-stack">
                            <section className="dashboard-welcome">
                                <div>
                                    <p className="eyebrow">Your workspace</p>
                                    <h1>Welcome back, {username}</h1>
                                    <p>Your files, photos, and documents—all in one place.</p>
                                </div>
                                <button
                                    type="button"
                                    className="button button-primary"
                                    onClick={() => navigateTo("upload")}
                                >
                                    <Upload size={17} aria-hidden="true" />
                                    Upload files
                                </button>
                            </section>

                            <section className="dashboard-stats" aria-label="Storage overview">
                                <article className="stat-card">
                                    <div className="stat-icon stat-icon-blue">
                                        <FolderOpen size={19} aria-hidden="true" />
                                    </div>
                                    <span>Total files</span>
                                    <strong>{storageInfo.fileCount}</strong>
                                    <small>Files in your library</small>
                                </article>
                                <article className="stat-card">
                                    <div className="stat-icon stat-icon-violet">
                                        <HardDrive size={19} aria-hidden="true" />
                                    </div>
                                    <span>Storage used</span>
                                    <strong>{formatSize(storageInfo.totalSize)}</strong>
                                    <small>Across all your files</small>
                                </article>
                                <article className="stat-card capacity-stat">
                                    <div className="stat-icon stat-icon-teal">
                                        <Cloud size={19} aria-hidden="true" />
                                    </div>
                                    <span>Storage capacity</span>
                                    <strong>Not configured</strong>
                                    <small>No account quota is set</small>
                                </article>
                            </section>

                            <section className="panel-card capacity-panel">
                                <div className="panel-heading">
                                    <div>
                                        <h2>Storage usage</h2>
                                        <p>{formatSize(storageInfo.totalSize)} used</p>
                                    </div>
                                    <span className="capacity-unconfigured">Capacity not configured</span>
                                </div>
                                <div
                                    className="capacity-meter capacity-meter-indeterminate"
                                    role="progressbar"
                                    aria-label="Storage usage"
                                    aria-valuetext={`Capacity is not configured; ${formatSize(storageInfo.totalSize)} used`}
                                >
                                    <span />
                                </div>
                                <p className="capacity-footnote">
                                    Storage has no configured account-wide limit. Each upload is limited to 50 MB.
                                </p>
                            </section>

                            <div className="dashboard-lower-grid">
                                <section className="panel-card recent-files-panel">
                                    <div className="panel-heading">
                                        <div>
                                            <h2>Recent files</h2>
                                            <p>Your latest additions</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="text-button"
                                            onClick={() => navigateTo("my-files")}
                                        >
                                            View all
                                            <ChevronRight size={15} aria-hidden="true" />
                                        </button>
                                    </div>
                                    {files.length === 0 ? (
                                        <div className="empty-state-compact">
                                            <FolderOpen size={24} aria-hidden="true" />
                                            <p>No files yet. Upload a file to get started.</p>
                                        </div>
                                    ) : (
                                        <div className="recent-file-list">
                                            {files.slice(0, 5).map((file) => (
                                                <div className="recent-file-row" key={file.id}>
                                                    <span className="recent-file-icon">
                                                        {getFilePreviewKind(file) === "image"
                                                            ? <ImageIcon size={18} aria-hidden="true" />
                                                            : <FileText size={18} aria-hidden="true" />}
                                                    </span>
                                                    <div className="recent-file-main">
                                                        <strong title={file.original_name}>
                                                            {file.original_name}
                                                        </strong>
                                                        <span>
                                                            {file.uploaded_at
                                                                ? new Date(file.uploaded_at).toLocaleDateString()
                                                                : "Date unavailable"}
                                                        </span>
                                                    </div>
                                                    <span className="recent-file-size">
                                                        {formatSize(file.size)}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="icon-button row-action"
                                                        aria-label={`View ${file.original_name}`}
                                                        onClick={() => viewFile(file)}
                                                    >
                                                        <ChevronRight size={17} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section className="panel-card quick-access-panel">
                                    <div className="panel-heading">
                                        <div>
                                            <h2>Quick access</h2>
                                            <p>Tools for your files</p>
                                        </div>
                                        <Sparkles size={19} aria-hidden="true" />
                                    </div>
                                    <button
                                        type="button"
                                        className="quick-access-link"
                                        onClick={() => navigateTo("compression")}
                                    >
                                        <span className="quick-access-icon">
                                            <Shrink size={18} aria-hidden="true" />
                                        </span>
                                        <span>
                                            <strong>Compress a file</strong>
                                            <small>Optimize images and PDFs</small>
                                        </span>
                                        <ChevronRight size={17} aria-hidden="true" />
                                    </button>
                                    <button
                                        type="button"
                                        className="quick-access-link"
                                        onClick={() => navigateTo("pdf-converter")}
                                    >
                                        <span className="quick-access-icon quick-access-icon-violet">
                                            <FileText size={18} aria-hidden="true" />
                                        </span>
                                        <span>
                                            <strong>PDF converter</strong>
                                            <small>Turn documents into PDF</small>
                                        </span>
                                        <ChevronRight size={17} aria-hidden="true" />
                                    </button>
                                </section>
                            </div>
                        </div>
                    )}

                    {activePage === "my-files" && (
                        <div className="page-stack">
                            <section className="page-intro-row">
                                <div>
                                    <p className="eyebrow">Your library</p>
                                    <h1>My Files</h1>
                                    <p>Browse, preview, download, and manage your stored files.</p>
                                </div>
                                <button
                                    type="button"
                                    className="button button-primary"
                                    onClick={() => navigateTo("upload")}
                                >
                                    <Upload size={17} aria-hidden="true" />
                                    Upload files
                                </button>
                            </section>
                            <div className="file-toolbar">
                                <label className="search-field">
                                    <Search size={17} aria-hidden="true" />
                                    <input
                                        type="search"
                                        placeholder="Search files"
                                        value={fileQuery}
                                        onChange={(event) => setFileQuery(event.target.value)}
                                        aria-label="Search files"
                                    />
                                </label>
                                <span>{filteredFiles.length} file{filteredFiles.length === 1 ? "" : "s"}</span>
                            </div>
                            {filteredFiles.length === 0 ? (
                                <div className="panel-card empty-state">
                                    <FolderOpen size={34} aria-hidden="true" />
                                    <h2>{files.length === 0 ? "Your library is empty" : "No files found"}</h2>
                                    <p>
                                        {files.length === 0
                                            ? "Upload your first file to see it here."
                                            : "Try another search term."}
                                    </p>
                                    {files.length === 0 && (
                                        <button
                                            type="button"
                                            className="button button-primary"
                                            onClick={() => navigateTo("upload")}
                                        >
                                            Upload a file
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="stored-file-list">
                                    {filteredFiles.map((file) => renderFileCard(file))}
                                </div>
                            )}
                        </div>
                    )}

                    {activePage === "upload" && (
                        <div className="page-stack">
                            <section className="page-intro-row">
                                <div>
                                    <p className="eyebrow">Add to your library</p>
                                    <h1>Upload Files</h1>
                                    <p>Upload files and photos to your PersonalStorage account.</p>
                                </div>
                            </section>
                            <section className="panel-card upload-panel">
                                <div className="panel-heading">
                                    <div>
                                        <h2>Select a file</h2>
                                        <p>Files up to 50 MB are supported.</p>
                                    </div>
                                    <span className="panel-heading-icon">
                                        <Upload size={19} aria-hidden="true" />
                                    </span>
                                </div>
                                <label className="tool-label" htmlFor="fileInput">
                                    Choose a file or photo
                                </label>
                                <div className="upload-dropzone">
                                    <Cloud size={30} aria-hidden="true" />
                                    <strong>Choose a file from your device</strong>
                                    <span>Images, documents, and other files up to 50 MB</span>
                                    <input
                                        id="fileInput"
                                        type="file"
                                        onChange={handleFileChange}
                                        disabled={loading}
                                    />
                                </div>
                                {selectedFile && (
                                    <p className="selected-file">
                                        Selected: <strong>{selectedFile.name}</strong>
                                        {" "}({formatSize(selectedFile.size)})
                                    </p>
                                )}
                                <div className="upload-form-actions">
                                    {uploading && (
                                        <div className="upload-progress">
                                            <progress value={uploadProgress} max="100" />
                                            <span>{uploadProgress}%</span>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        className="button button-primary"
                                        onClick={uploadFile}
                                        disabled={loading || !selectedFile}
                                    >
                                        {uploading ? "Uploading..." : "Upload file"}
                                    </button>
                                </div>
                                {message && <p className="form-message" role="status">{message}</p>}
                            </section>
                        </div>
                    )}

                    {activePage === "compression" && (
                        <div className="page-stack">
                            <section className="page-intro-row">
                                <div>
                                    <p className="eyebrow">Optimize your storage</p>
                                    <h1>Compression</h1>
                                    <p>Choose an image or PDF. The original is always preserved.</p>
                                </div>
                            </section>
                            {renderCompressionStatus()}
                            <section className="panel-card">
                                <div className="panel-heading">
                                    <div>
                                        <h2>Choose a file to compress</h2>
                                        <p>Image quality is adjustable. PDF results depend on document contents.</p>
                                    </div>
                                </div>
                                {files.length === 0 ? (
                                    <div className="empty-state-compact">
                                        <FolderOpen size={24} aria-hidden="true" />
                                        <p>Upload a file before using compression.</p>
                                    </div>
                                ) : (
                                    <div className="stored-file-list">
                                        {files.map((file) => renderFileCard(file))}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}

                    {activePage === "pdf-converter" && (
                        <div className="page-stack">
                            <section className="page-intro-row">
                                <div>
                                    <p className="eyebrow">Document tools</p>
                                    <h1>PDF Converter</h1>
                                    <p>Convert supported images and documents into a PDF.</p>
                                </div>
                            </section>
                            <FileTools onSaveFile={saveGeneratedFile} />
                        </div>
                    )}

                    {activePage === "shared-files" && (
                        <div className="page-stack">
                            <section className="page-intro-row">
                                <div>
                                    <p className="eyebrow">Share from your device</p>
                                    <h1>Shared Files</h1>
                                    <p>Share original files using your browser or download them to share another way.</p>
                                </div>
                            </section>
                            <section className="panel-card upload-panel">
                                <div className="panel-heading">
                                    <div>
                                        <h2>Choose files to share</h2>
                                        <p>Files are shared locally through your browser; no public links are created.</p>
                                    </div>
                                    <span className="panel-heading-icon">
                                        <Share2 size={19} aria-hidden="true" />
                                    </span>
                                </div>
                                <input
                                    id="share-files-input"
                                    type="file"
                                    multiple
                                    onChange={(event) =>
                                        setShareFiles(Array.from(event.target.files || []))
                                    }
                                    disabled={loading}
                                />
                                {shareFiles.length > 0 ? (
                                    <ul className="selected-share-list">
                                        {shareFiles.map((file, index) => (
                                            <li key={`${file.name}-${index}`}>
                                                <FileText size={17} aria-hidden="true" />
                                                <span>{file.name}</span>
                                                <small>{formatSize(file.size)}</small>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="tool-note">
                                        Select one or more files. If browser-based sharing is unavailable, the files will download individually.
                                    </p>
                                )}
                                <button
                                    type="button"
                                    className="button button-primary"
                                    onClick={shareSelectedOriginalFiles}
                                    disabled={loading || shareFiles.length === 0}
                                >
                                    <Share2 size={17} aria-hidden="true" />
                                    Share selected files
                                </button>
                                {message && <p className="form-message" role="status">{message}</p>}
                            </section>
                            <section className="panel-card">
                                <div className="panel-heading">
                                    <div>
                                        <h2>Shared with you</h2>
                                        <p>Files shared by other PersonalStorage accounts</p>
                                    </div>
                                </div>
                                <div className="empty-state-compact">
                                    <Share2 size={24} aria-hidden="true" />
                                    <p>There are no stored shared links in this app.</p>
                                </div>
                            </section>
                        </div>
                    )}

                    {activePage === "settings" && (
                        <div className="page-stack">
                            <section className="page-intro-row">
                                <div>
                                    <p className="eyebrow">Personalize your workspace</p>
                                    <h1>Settings</h1>
                                    <p>Manage your appearance, account, and preferences.</p>
                                </div>
                            </section>
                            <section className="panel-card settings-panel">
                                <div className="panel-heading">
                                    <div>
                                        <h2>Appearance</h2>
                                        <p>Choose how PersonalStorage looks on this device.</p>
                                    </div>
                                    <Palette size={19} aria-hidden="true" />
                                </div>
                                <div className="theme-options" role="group" aria-label="Theme">
                                    {[
                                        { id: "light", label: "Light mode", icon: Sun },
                                        { id: "dark", label: "Dark mode", icon: Moon },
                                        { id: "system", label: "System", icon: Monitor }
                                    ].map(({ id, label, icon: Icon }) => (
                                        <button
                                            key={id}
                                            type="button"
                                            className={`theme-option${theme === id ? " theme-option-active" : ""}`}
                                            aria-pressed={theme === id}
                                            onClick={() => setTheme(id)}
                                        >
                                            <Icon size={18} aria-hidden="true" />
                                            <span>{label}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="accent-picker">
                                    <strong>Accent color</strong>
                                    <div role="group" aria-label="Accent color">
                                        {accentOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                className={`accent-swatch${accentColor === option.value ? " accent-swatch-active" : ""}`}
                                                style={{ "--swatch-color": option.value }}
                                                aria-label={`${option.name} accent`}
                                                aria-pressed={accentColor === option.value}
                                                onClick={() => setAccentColor(option.value)}
                                            >
                                                {accentColor === option.value && (
                                                    <Check size={15} aria-hidden="true" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            <div className="settings-grid">
                                <section className="panel-card">
                                    <div className="panel-heading">
                                        <div>
                                            <h2>Profile settings</h2>
                                            <p>Update your account name and email.</p>
                                        </div>
                                        <UserRound size={19} aria-hidden="true" />
                                    </div>
                                    <form className="settings-form" onSubmit={saveProfileSettings}>
                                        <label>
                                            Username
                                            <input
                                                type="text"
                                                value={profileForm.username}
                                                maxLength="50"
                                                required
                                                onChange={(event) =>
                                                    setProfileForm((current) => ({
                                                        ...current,
                                                        username: event.target.value
                                                    }))
                                                }
                                            />
                                        </label>
                                        <label>
                                            Email address
                                            <input
                                                type="email"
                                                value={profileForm.email}
                                                required
                                                onChange={(event) =>
                                                    setProfileForm((current) => ({
                                                        ...current,
                                                        email: event.target.value
                                                    }))
                                                }
                                            />
                                        </label>
                                        {profileMessage && (
                                            <p className="form-message" role="status">{profileMessage}</p>
                                        )}
                                        <button
                                            type="submit"
                                            className="button button-primary"
                                            disabled={profileBusy}
                                        >
                                            {profileBusy ? "Saving..." : "Save profile"}
                                        </button>
                                    </form>
                                </section>

                                <section className="panel-card">
                                    <div className="panel-heading">
                                        <div>
                                            <h2>Password settings</h2>
                                            <p>Verify your current password before changing it.</p>
                                        </div>
                                        <LockKeyhole size={19} aria-hidden="true" />
                                    </div>
                                    <form className="settings-form" onSubmit={savePasswordSettings}>
                                        <label>
                                            Current password
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                autoComplete="current-password"
                                                required
                                                onChange={(event) => setCurrentPassword(event.target.value)}
                                            />
                                        </label>
                                        <label>
                                            New password
                                            <input
                                                type="password"
                                                value={settingsNewPassword}
                                                minLength="6"
                                                autoComplete="new-password"
                                                required
                                                onChange={(event) => setSettingsNewPassword(event.target.value)}
                                            />
                                        </label>
                                        <label>
                                            Confirm new password
                                            <input
                                                type="password"
                                                value={confirmSettingsPassword}
                                                minLength="6"
                                                autoComplete="new-password"
                                                required
                                                onChange={(event) =>
                                                    setConfirmSettingsPassword(event.target.value)
                                                }
                                            />
                                        </label>
                                        {passwordMessage && (
                                            <p className="form-message" role="status">{passwordMessage}</p>
                                        )}
                                        <button
                                            type="submit"
                                            className="button button-primary"
                                            disabled={passwordBusy}
                                        >
                                            {passwordBusy ? "Updating..." : "Update password"}
                                        </button>
                                    </form>
                                </section>
                            </div>

                            <section className="panel-card">
                                <div className="panel-heading">
                                    <div>
                                        <h2>Storage information</h2>
                                        <p>Your current account usage.</p>
                                    </div>
                                    <HardDrive size={19} aria-hidden="true" />
                                </div>
                                <div className="settings-info-grid">
                                    <div>
                                        <span>Total files</span>
                                        <strong>{storageInfo.fileCount}</strong>
                                    </div>
                                    <div>
                                        <span>Storage used</span>
                                        <strong>{formatSize(storageInfo.totalSize)}</strong>
                                    </div>
                                    <div>
                                        <span>Account capacity</span>
                                        <strong>Not configured</strong>
                                    </div>
                                    <div>
                                        <span>Upload limit</span>
                                        <strong>50 MB per file</strong>
                                    </div>
                                </div>
                            </section>

                            <section className="panel-card">
                                <div className="panel-heading">
                                    <div>
                                        <h2>Notification preferences</h2>
                                        <p>Preferences are saved in this browser.</p>
                                    </div>
                                    <Bell size={19} aria-hidden="true" />
                                </div>
                                <div className="preference-list">
                                    {[
                                        {
                                            id: "fileActivity",
                                            label: "File activity",
                                            description: "Updates about uploads and file changes."
                                        },
                                        {
                                            id: "storageUpdates",
                                            label: "Storage updates",
                                            description: "Storage usage and account information."
                                        },
                                        {
                                            id: "sharing",
                                            label: "Sharing",
                                            description: "Updates about file sharing activity."
                                        }
                                    ].map((preference) => (
                                        <label className="preference-row" key={preference.id}>
                                            <span>
                                                <strong>{preference.label}</strong>
                                                <small>{preference.description}</small>
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={notificationPreferences[preference.id]}
                                                onChange={(event) =>
                                                    updateNotificationPreference(
                                                        preference.id,
                                                        event.target.checked
                                                    )
                                                }
                                            />
                                        </label>
                                    ))}
                                </div>
                                <p className="tool-note">
                                    These preferences are stored locally; server-delivered notifications are not currently available.
                                </p>
                            </section>
                        </div>
                    )}
                </main>
            </div>

            {filePreview && (
                <div
                    className="preview-modal-backdrop"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeFilePreview();
                        }
                    }}
                >
                    <section
                        className="preview-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="file-preview-title"
                    >
                        <header className="preview-modal-header">
                            <div>
                                <h2 id="file-preview-title">
                                    {filePreview.file.original_name}
                                </h2>
                                <p>{formatSize(filePreview.file.size)}</p>
                            </div>
                            <button
                                type="button"
                                className="preview-close-button"
                                aria-label="Close preview"
                                onClick={closeFilePreview}
                            >
                                Close
                            </button>
                        </header>

                        <div className="preview-modal-content">
                            {filePreview.status === "loading" && (
                                <div className="preview-loading" role="status">
                                    <span className="preview-spinner" aria-hidden="true" />
                                    Loading preview...
                                </div>
                            )}

                            {(filePreview.status === "error" ||
                                filePreview.status === "unavailable") && (
                                <p className="preview-error" role="alert">
                                    {filePreview.message}
                                </p>
                            )}

                            {filePreview.status === "ready" &&
                                filePreview.kind === "image" && (
                                    <img
                                        className="preview-image"
                                        src={filePreview.url}
                                        alt={filePreview.file.original_name}
                                    />
                                )}

                            {filePreview.status === "ready" &&
                                filePreview.kind === "pdf" && (
                                    <iframe
                                        className="preview-pdf"
                                        src={filePreview.url}
                                        title={`Preview of ${filePreview.file.original_name}`}
                                    />
                                )}

                            {filePreview.status === "ready" &&
                                filePreview.kind === "text" && (
                                    <pre className="preview-text">{filePreview.text}</pre>
                                )}

                            {filePreview.status === "ready" &&
                                filePreview.kind === "audio" && (
                                    <audio
                                        className="preview-media"
                                        src={filePreview.url}
                                        controls
                                    >
                                        Your browser cannot play this audio format. Download the file to listen.
                                    </audio>
                                )}

                            {filePreview.status === "ready" &&
                                filePreview.kind === "video" && (
                                    <video
                                        className="preview-video"
                                        src={filePreview.url}
                                        controls
                                    >
                                        Your browser cannot play this video format. Download the file to watch.
                                    </video>
                                )}
                        </div>

                        <footer className="preview-modal-actions">
                            <button
                                type="button"
                                className="upload-button download-file-button"
                                onClick={() => downloadFile(filePreview.file)}
                            >
                                Download File
                            </button>
                            <button
                                type="button"
                                className="preview-close-button"
                                onClick={closeFilePreview}
                            >
                                Close Preview
                            </button>
                        </footer>
                    </section>
                </div>
            )}

        </div>

    );

}

export default App;