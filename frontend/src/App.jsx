import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";

function App() {
  const [page, setPage] = useState(
    localStorage.getItem("token") ? "dashboard" : "login"
  );

  const [message, setMessage] = useState("");

  // Register
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  // Login
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Files
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [storage, setStorage] = useState({
    fileCount: 0,
    totalSize: 0,
  });

  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  // =====================================
  // REGISTER
  // =====================================

  const register = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: registerUsername,
          password: registerPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Registration failed");
        return;
      }

      setMessage("Registration successful! Please login.");

      setRegisterUsername("");
      setRegisterPassword("");

      setTimeout(() => {
        setPage("login");
        setMessage("");
      }, 1200);
    } catch (error) {
      setMessage("Cannot connect to server.");
    }
  };

  // =====================================
  // LOGIN
  // =====================================

  const login = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);

      setLoginUsername("");
      setLoginPassword("");
      setMessage("");

      setPage("dashboard");
    } catch (error) {
      setMessage("Cannot connect to server.");
    }
  };

  // =====================================
  // LOAD FILES
  // =====================================

  const loadFiles = async () => {
    const currentToken = localStorage.getItem("token");

    if (!currentToken) return;

    try {
      const response = await fetch(`${API_URL}/files`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setFiles(data);
      }
    } catch (error) {
      console.error("Could not load files:", error);
    }
  };

  // =====================================
  // LOAD STORAGE
  // =====================================

  const loadStorage = async () => {
    const currentToken = localStorage.getItem("token");

    if (!currentToken) return;

    try {
      const response = await fetch(`${API_URL}/files/storage/info`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setStorage(data);
      }
    } catch (error) {
      console.error("Could not load storage:", error);
    }
  };

  // =====================================
  // LOAD DASHBOARD DATA
  // =====================================

  useEffect(() => {
    if (page === "dashboard") {
      loadFiles();
      loadStorage();
    }
  }, [page]);

  // =====================================
  // FILE SELECT
  // =====================================

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  // =====================================
  // UPLOAD FILE
  // =====================================

  const uploadFile = async () => {
    if (!selectedFile) {
      setMessage("Please select a file first.");
      return;
    }

    const currentToken = localStorage.getItem("token");

    if (!currentToken) {
      setPage("login");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setUploading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/files/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Upload failed");
        return;
      }

      setMessage("File uploaded successfully!");

      setSelectedFile(null);

      document.getElementById("fileInput").value = "";

      await loadFiles();
      await loadStorage();
    } catch (error) {
      setMessage("Upload failed. Check your backend.");
    } finally {
      setUploading(false);
    }
  };

  // =====================================
  // DOWNLOAD FILE
  // =====================================

  const downloadFile = async (file) => {
    const currentToken = localStorage.getItem("token");

    try {
      const response = await fetch(
        `${API_URL}/files/download/${file.id}`,
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );

      if (!response.ok) {
        alert("Could not download file.");
        return;
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = file.original_name;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert("Download failed.");
    }
  };

  // =====================================
  // DELETE FILE
  // =====================================

  const deleteFile = async (id) => {
    const currentToken = localStorage.getItem("token");

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this file?"
    );

    if (!confirmDelete) return;

    try {
      const response = await fetch(`${API_URL}/files/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Delete failed");
        return;
      }

      await loadFiles();
      await loadStorage();
    } catch (error) {
      alert("Delete failed.");
    }
  };

  // =====================================
  // LOGOUT
  // =====================================

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");

    setFiles([]);
    setStorage({
      fileCount: 0,
      totalSize: 0,
    });

    setPage("login");
  };

  // =====================================
  // FORMAT FILE SIZE
  // =====================================

  const formatSize = (bytes) => {
    if (!bytes) return "0 B";

    const units = ["B", "KB", "MB", "GB"];

    const index = Math.floor(
      Math.log(bytes) / Math.log(1024)
    );

    return (
      (bytes / Math.pow(1024, index)).toFixed(2) +
      " " +
      units[index]
    );
  };

  // =====================================
  // LOGIN PAGE
  // =====================================

  if (page === "login") {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="logo">☁️</div>

          <h1>Personal Storage</h1>

          <p className="subtitle">
            Store your files and photos securely
          </p>

          <form onSubmit={login}>
            <label>Username</label>

            <input
              type="text"
              placeholder="Enter username"
              value={loginUsername}
              onChange={(e) =>
                setLoginUsername(e.target.value)
              }
              required
            />

            <label>Password</label>

            <input
              type="password"
              placeholder="Enter password"
              value={loginPassword}
              onChange={(e) =>
                setLoginPassword(e.target.value)
              }
              required
            />

            <button className="primary-button" type="submit">
              Login
            </button>
          </form>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          <p className="switch-text">
            Don't have an account?

            <button
              className="link-button"
              onClick={() => {
                setPage("register");
                setMessage("");
              }}
            >
              Create Account
            </button>
          </p>
        </div>
      </div>
    );
  }

  // =====================================
  // REGISTER PAGE
  // =====================================

  if (page === "register") {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="logo">🔐</div>

          <h1>Create Account</h1>

          <p className="subtitle">
            Create your personal storage account
          </p>

          <form onSubmit={register}>
            <label>Username</label>

            <input
              type="text"
              placeholder="Choose username"
              value={registerUsername}
              onChange={(e) =>
                setRegisterUsername(e.target.value)
              }
              required
            />

            <label>Password</label>

            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={registerPassword}
              onChange={(e) =>
                setRegisterPassword(e.target.value)
              }
              minLength="6"
              required
            />

            <button className="primary-button" type="submit">
              Register
            </button>
          </form>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          <p className="switch-text">
            Already have an account?

            <button
              className="link-button"
              onClick={() => {
                setPage("login");
                setMessage("");
              }}
            >
              Login
            </button>
          </p>
        </div>
      </div>
    );
  }

  // =====================================
  // DASHBOARD
  // =====================================

  return (
    <div className="dashboard">
      <header className="navbar">
        <div className="brand">
          ☁️ Personal Storage
        </div>

        <div className="user-section">
          <span>👤 {username}</span>

          <button
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">

        <div className="welcome">
          <h1>My Storage</h1>

          <p>
            Welcome back, <strong>{username}</strong>!
          </p>
        </div>

        {/* STORAGE CARD */}

        <div className="storage-card">
          <div>
            <span className="storage-icon">💾</span>

            <div>
              <h3>Storage Used</h3>

              <p>
                {formatSize(storage.totalSize)}
              </p>
            </div>
          </div>

          <div className="storage-count">
            <strong>{storage.fileCount}</strong>
            <span>Files</span>
          </div>
        </div>

        {/* UPLOAD */}

        <div className="upload-card">
          <h2>Upload Files & Photos</h2>

          <p>
            Select a photo, document, video or other file.
          </p>

          <div className="upload-area">
            <input
              id="fileInput"
              type="file"
              onChange={handleFileChange}
            />

            {selectedFile && (
              <p className="selected-file">
                Selected: <strong>{selectedFile.name}</strong>
              </p>
            )}

            <button
              className="upload-button"
              onClick={uploadFile}
              disabled={uploading}
            >
              {uploading
                ? "Uploading..."
                : "📤 Upload File"}
            </button>
          </div>

          {message && (
            <div className="message">
              {message}
            </div>
          )}
        </div>

        {/* FILES */}

        <div className="files-section">
          <div className="section-header">
            <h2>My Files</h2>

            <button
              className="refresh-button"
              onClick={() => {
                loadFiles();
                loadStorage();
              }}
            >
              🔄 Refresh
            </button>
          </div>

          {files.length === 0 ? (
            <div className="empty-state">
              <div>📂</div>

              <h3>No files yet</h3>

              <p>
                Upload your first file or photo above.
              </p>
            </div>
          ) : (
            <div className="file-grid">
              {files.map((file) => (
                <div className="file-card" key={file.id}>
                  <div className="file-icon">
                    {file.mimetype.startsWith("image/")
                      ? "🖼️"
                      : file.mimetype.startsWith("video/")
                      ? "🎬"
                      : file.mimetype.includes("pdf")
                      ? "📕"
                      : "📄"}
                  </div>

                  <div className="file-info">
                    <h3 title={file.original_name}>
                      {file.original_name}
                    </h3>

                    <p>
                      {formatSize(file.size)}
                    </p>

                    <p>
                      {new Date(
                        file.uploaded_at
                      ).toLocaleString()}
                    </p>
                  </div>

                  <div className="file-actions">
                    <button
                      onClick={() =>
                        downloadFile(file)
                      }
                    >
                      ⬇️ Download
                    </button>

                    <button
                      className="delete-button"
                      onClick={() =>
                        deleteFile(file.id)
                      }
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

export default App;