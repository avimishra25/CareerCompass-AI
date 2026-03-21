const express = require("express");
const multer = require("multer");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// =======================
// 🔥 JOB ROLE DATA
// =======================
const JOB_ROLES = {
  "frontend developer": ["html", "css", "javascript", "react"],
  "backend developer": ["node", "express", "mongodb", "sql"],
  "data scientist": ["python", "pandas", "numpy", "machine learning"],
};

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

// =======================
// 🚀 MAIN ROUTE
// =======================
app.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    const filePath = req.file.path;

    // Send to NLP
    const formData = new FormData();
    formData.append("resume", fs.createReadStream(filePath));

    const response = await axios.post(
      "http://127.0.0.1:8000/analyze",
      formData,
      {
        headers: formData.getHeaders(),
      }
    );

    const userSkills = response.data.skills;

    // =======================
    // 🔥 MATCHING LOGIC
    // =======================
    let results = {};

    for (let role in JOB_ROLES) {
      const requiredSkills = JOB_ROLES[role];

      const matched = requiredSkills.filter(skill =>
        userSkills.includes(skill)
      );

      const weight = 0.8; // importance factor

      const score = Math.round(
        ((matched.length / requiredSkills.length) * 100) * weight +
        (userSkills.length > 5 ? 10 : 0)
      );

      const missing = requiredSkills.filter(skill =>
        !userSkills.includes(skill)
      );

      results[role] = {
        score: score.toFixed(0),
        missing,
      };
    }

    // =======================
    // ⭐ BEST ROLE LOGIC
    // =======================
    let bestRole = "";
    let highestScore = 0;

    for (let role in results) {
      if (parseInt(results[role].score) > highestScore) {
        highestScore = parseInt(results[role].score);
        bestRole = role;
      }
    }

    // =======================
    // FINAL RESPONSE
    // =======================
    res.json({
      skills: userSkills,
      match: results,
      bestRole: {
        role: bestRole,
        score: highestScore,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing resume");
  }
});

// Start server
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});