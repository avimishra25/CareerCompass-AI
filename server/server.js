const express = require("express");
const multer = require("multer");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

const app = express();   // ✅ THIS WAS MISSING

// Middleware
app.use(cors());
app.use(express.json());

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Test route
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// Upload + NLP route
app.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    const filePath = req.file.path;

    const formData = new FormData();
    formData.append("resume", fs.createReadStream(filePath));

    const response = await axios.post(
      "http://127.0.0.1:8000/analyze",
      formData,
      {
        headers: formData.getHeaders(),
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing resume");
  }
});

// Start server
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});