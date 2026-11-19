require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const fileRoutes = require("./routes/files");

const app = express();

const PORT =
    process.env.PORT || 5000;


// ==========================================
// CORS
// ==========================================

app.use(
    cors({
        origin: true,
        credentials: true,
        exposedHeaders: ["Content-Disposition", "X-Original-Size"]
    })
);


// ==========================================
// JSON
// ==========================================

app.use(
    express.json()
);


// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {

    res.json({
        message:
            "Personal Storage Backend is Running"
    });

});


// ==========================================
// ROUTES
// ==========================================

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/files",
    fileRoutes
);


// ==========================================
// START SERVER
// ==========================================

app.listen(
    PORT,
    () => {

        console.log(
            "================================="
        );

        console.log(
            "   PERSONAL STORAGE BACKEND"
        );

        console.log(
            "================================="
        );

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            "================================="
        );

    }
);