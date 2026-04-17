require("dotenv").config();

const express  = require("express");
const multer   = require("multer");
const cors     = require("cors");
const axios    = require("axios");
const fs       = require("fs");
const path     = require("path");
const FormData = require("form-data");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const protect    = require("./middleware/auth");
const Analysis   = require("./models/Analysis");
const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const app = express();

app.use(cors({
  origin: [
    'https://career-compass-ai-git-main-avimishra25s-projects.vercel.app/',
    'https://career-compass-m09x90z1l-avimishra25s-projects.vercel.app/',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// ─── Job Roles ────────────────────────────────────────────────
const JOB_ROLES = {
  "frontend developer": {
    skills: ["html", "css", "javascript", "react", "typescript", "tailwind", "redux", "nextjs"],
    emoji: "🎨",
  },
  "backend developer": {
    skills: ["node", "express", "mongodb", "sql", "python", "rest api", "docker", "postgresql"],
    emoji: "⚙️",
  },
  "fullstack developer": {
    skills: ["html", "css", "javascript", "react", "node", "express", "mongodb", "sql", "git"],
    emoji: "💻",
  },
  "data scientist": {
    skills: ["python", "pandas", "numpy", "machine learning", "tensorflow", "sql", "matplotlib", "scikit-learn"],
    emoji: "📊",
  },
  "ml engineer": {
    skills: ["python", "tensorflow", "pytorch", "machine learning", "deep learning", "numpy", "docker", "mlops"],
    emoji: "🤖",
  },
  "devops engineer": {
    skills: ["docker", "kubernetes", "aws", "linux", "git", "ci/cd", "terraform", "ansible"],
    emoji: "🔧",
  },
  "cloud engineer": {
    skills: ["aws", "azure", "gcp", "docker", "kubernetes", "terraform", "linux", "networking"],
    emoji: "☁️",
  },
  "mobile developer": {
    skills: ["react native", "flutter", "android", "ios", "kotlin", "swift", "firebase"],
    emoji: "📱",
  },
  "ui/ux designer": {
    skills: ["figma", "css", "html", "wireframing", "prototyping", "user research", "adobe xd"],
    emoji: "✏️",
  },
  "cybersecurity analyst": {
    skills: ["networking", "linux", "python", "ethical hacking", "firewalls", "cryptography", "siem"],
    emoji: "🔐",
  },
  "data engineer": {
    skills: ["python", "sql", "apache spark", "kafka", "airflow", "aws", "postgresql", "dbt"],
    emoji: "🗄️",
  },
  "ai engineer": {
    skills: ["python", "openai", "langchain", "llm", "rag", "vector database", "fastapi", "docker"],
    emoji: "🧠",
  },
};

// ─── Multer (disk storage) ────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("uploads/")) fs.mkdirSync("uploads/");
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ─── Auth routes ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.get("/", (req, res) => res.send("CareerCompass backend running 🚀"));

// ─── Upload & Analyze ─────────────────────────────────────────
// FIX 1: was `authMiddleware` — correct name is `protect`
// FIX 2: was `file.buffer` (memory) — now reads from disk since diskStorage is used
app.post("/upload", protect, upload.single("resume"), async (req, res) => {
  const filePath = req.file?.path;  // save path early for cleanup in finally

  try {
    const file       = req.file;
    const targetRole = req.body.targetRole || null;

    if (!file) return res.status(400).json({ error: "No file uploaded" });

    // Forward to Python NLP service — read file from disk
    const form = new FormData();
    form.append("resume", fs.createReadStream(filePath), {
      filename:    file.originalname,
      contentType: file.mimetype,
    });
    if (targetRole) form.append("targetRole", targetRole);

    const nlpRes = await axios.post(`${ML_URL}/analyze`, form, {
      headers: form.getHeaders(),
    });

    const {
      skills             = [],
      match              = {},
      bestRole           = null,
      ats_score          = null,
      ats_breakdown      = {},
      targetRoleAnalysis = null,
    } = nlpRes.data;

    // Save to MongoDB
    const analysis = await Analysis.create({
      user:         req.user.id,
      skills,
      match,
      bestRole,
      resumeName:   file.originalname,
      targetRole,
      atsScore:     ats_score,
      atsBreakdown: ats_breakdown,
    });

    return res.json({
      skills,
      match,
      bestRole,
      atsScore:           ats_score,
      atsBreakdown:       ats_breakdown,
      targetRoleAnalysis,
      analysisId:         analysis._id,
    });

  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: "Analysis failed", details: err.message });
  } finally {
    // Always clean up the temp file from disk
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

// ─── History ──────────────────────────────────────────────────
app.get("/api/history", protect, async (req, res) => {
  try {
    const analyses = await Analysis.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(analyses);
  } catch (error) {
    res.status(500).json({ message: "Error fetching history" });
  }
});

app.delete("/api/history/:id", protect, async (req, res) => {
  try {
    const analysis = await Analysis.findOneAndDelete({
      _id:  req.params.id,
      user: req.user._id,
    });
    if (!analysis) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting" });
  }
});

// ─── AI Agent proxy ───────────────────────────────────────────
app.post("/api/agent/chat", protect, async (req, res) => {
  try {
    const response = await axios.post(
      `${ML_URL}/agent/gap`,
      req.body
    );
    res.json(response.data);
  } catch (error) {
    const msg = error.response?.data?.error || "Agent unavailable";
    res.status(500).json({ reply: msg, error: msg });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));