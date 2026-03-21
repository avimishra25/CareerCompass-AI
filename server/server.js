const express = require("express");
const multer = require("multer");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// File storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Route
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// Upload route
app.post("/upload", upload.single("resume"), (req, res) => {
  res.json({
    message: "File uploaded successfully",
    file: req.file,
  });
});

// Start server
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});