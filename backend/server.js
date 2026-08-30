const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const fileRoutes = require("./routes/files");

const app = express();

const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Personal Storage Backend is Running"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);

app.listen(PORT, () => {
    console.log("=================================");
    console.log("   PERSONAL STORAGE BACKEND");
    console.log("=================================");
    console.log(`Server: http://localhost:${PORT}`);
    console.log("=================================");
});