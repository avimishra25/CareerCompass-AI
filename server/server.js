require("dotenv").config();

const express  = require("express");
const multer   = require("multer");
const cors     = require("cors");
const axios    = require("axios");
const fs       = require("fs");
const path     = require("path");
const { randomUUID } = require("crypto");
const FormData = require("form-data");
const mongoose = require("mongoose");
const passport = require("./config/passport"); // ← Google OAuth strategy
const { rateLimit } = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const protect    = require("./middleware/auth");
const Analysis   = require("./models/Analysis");
const JDMatch    = require("./models/JDMatch");

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const app    = express();
// Set only to the number of trusted reverse-proxy hops in this deployment.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 0));
const internalHeaders = () => ({ "X-Internal-Key": process.env.INTERNAL_API_KEY || "" });
const jdMatchLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many JD match requests. Try again later." },
});
const chatLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many chat requests. Try again later." },
});

app.use(cors({
  origin: [
    "https://career-compass-ai-omega-smoky.vercel.app",
    "https://career-compass-ai-git-main-avimishra25s-projects.vercel.app",
    "https://career-compass-5tm4sgjrd-avimishra25s-projects.vercel.app",
    "http://localhost:3000",
  ],
  methods:        ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials:    true,
}));

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again later." },
}));
app.use(express.json());
app.use(passport.initialize()); // ← required for passport (no sessions needed, we use JWT)

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// ─── Job Roles ────────────────────────────────────────────────
const JOB_ROLES = {
  "frontend developer":    { skills: ["html","css","javascript","react","typescript","tailwind","redux","nextjs"],            emoji: "🎨" },
  "backend developer":     { skills: ["node","express","mongodb","sql","python","rest api","docker","postgresql"],            emoji: "⚙️"  },
  "fullstack developer":   { skills: ["html","css","javascript","react","node","express","mongodb","sql","git"],              emoji: "💻" },
  "data scientist":        { skills: ["python","pandas","numpy","machine learning","tensorflow","sql","matplotlib","scikit-learn"], emoji: "📊" },
  "ml engineer":           { skills: ["python","tensorflow","pytorch","machine learning","deep learning","numpy","docker","mlops"], emoji: "🤖" },
  "devops engineer":       { skills: ["docker","kubernetes","aws","linux","git","ci/cd","terraform","ansible"],               emoji: "🔧" },
  "cloud engineer":        { skills: ["aws","azure","gcp","docker","kubernetes","terraform","linux","networking"],            emoji: "☁️"  },
  "mobile developer":      { skills: ["react native","flutter","android","ios","kotlin","swift","firebase"],                  emoji: "📱" },
  "ui/ux designer":        { skills: ["figma","css","html","wireframing","prototyping","user research","adobe xd"],           emoji: "✏️"  },
  "cybersecurity analyst": { skills: ["networking","linux","python","ethical hacking","firewalls","cryptography","siem"],     emoji: "🔐" },
  "data engineer":         { skills: ["python","sql","apache spark","kafka","airflow","aws","postgresql","dbt"],              emoji: "🗄️"  },
  "ai engineer":           { skills: ["python","openai","langchain","llm","rag","vector database","fastapi","docker"],        emoji: "🧠" },
};

// ─── Multer (disk storage) ────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("uploads/")) fs.mkdirSync("uploads/");
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => cb(null, randomUUID() + ".pdf"),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf" || path.extname(file.originalname).toLowerCase() !== ".pdf") {
      const error = new Error("Only PDF files are allowed");
      error.status = 400;
      return cb(error);
    }
    cb(null, true);
  },
});

// ─── Auth routes ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.get("/", (req, res) => res.send("CareerCompass backend running 🚀"));

// ─── Upload & Analyze ─────────────────────────────────────────
app.post("/upload", protect, upload.single("resume"), async (req, res) => {
  const filePath = req.file?.path;

  try {
    const file       = req.file;
    const targetRole = req.body.targetRole || null;

    if (!file) return res.status(400).json({ error: "No file uploaded" });
    if (targetRole !== null && (typeof targetRole !== "string" || targetRole.length > 100)) {
      return res.status(400).json({ error: "Invalid target role" });
    }
    const handle = await fs.promises.open(filePath, "r");
    const signature = Buffer.alloc(5);
    try {
      await handle.read(signature, 0, 5, 0);
    } finally {
      await handle.close();
    }
    if (!signature.equals(Buffer.from("%PDF-"))) {
      return res.status(400).json({ error: "Invalid PDF file" });
    }

    const form = new FormData();
    form.append("resume", fs.createReadStream(filePath), {
      filename:    file.originalname,
      contentType: file.mimetype,
    });
    if (targetRole) form.append("targetRole", targetRole);

    const nlpRes = await axios.post(`${ML_URL}/analyze`, form, {
      headers: { ...form.getHeaders(), ...internalHeaders() },
      timeout: 60000,
    });

    const {
      skills             = [],
      match              = {},
      bestRole           = null,
      ats_score          = null,
      ats_breakdown      = {},
      targetRoleAnalysis = null,
      ml_insights        = null,
    } = nlpRes.data;

    const analysis = await Analysis.create({
      user:         req.user.id,
      skills,
      match,
      bestRole,
      resumeName:   file.originalname,
      targetRole,
      atsScore:     ats_score,
      atsBreakdown: ats_breakdown,
      mlInsights:   ml_insights,
      resumeText:   typeof nlpRes.data.raw_text === "string" ? nlpRes.data.raw_text.slice(0, 50000) : undefined,
    });

    return res.json({
      skills,
      match,
      bestRole,
      atsScore:           ats_score,
      atsBreakdown:       ats_breakdown,
      targetRoleAnalysis,
      mlInsights:         ml_insights,
      analysisId:         analysis._id,
    });

  } catch (err) {
    console.error("Upload error:", err.message);
    const status = [400, 413].includes(err.response?.status) ? err.response.status : (err.isAxiosError ? 503 : 500);
    res.status(status).json({ error: status === 413 ? "PDF exceeds 5 MB limit" : "Analysis failed" });

  } finally {
    if (filePath) {
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        if (err.code !== "ENOENT") console.error("Upload cleanup failed");
      }
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
  } catch {
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
  } catch {
    res.status(500).json({ message: "Error deleting" });
  }
});

// ─── JD matching ──────────────────────────────────────────────
app.post("/api/jd-match", protect, jdMatchLimit, async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      Object.keys(data).some((key) => !["analysisId", "jd_text", "jdTitle"].includes(key)) ||
      typeof data.analysisId !== "string" || !/^[a-f\d]{24}$/i.test(data.analysisId) ||
      typeof data.jd_text !== "string" || !data.jd_text.trim() ||
      (data.jdTitle !== undefined && (typeof data.jdTitle !== "string" || data.jdTitle.length > 120))) {
    return res.status(400).json({ error: "Invalid JD match payload" });
  }
  if ([...data.jd_text].length > 8000) return res.status(413).json({ error: "JD exceeds 8000 characters" });
  try {
    const analysis = await Analysis.findOne({ _id: data.analysisId, user: req.user._id }).select("+resumeText");
    if (!analysis) return res.status(404).json({ error: "Analysis not found" });
    if (!analysis.resumeText?.trim()) {
      return res.status(400).json({ error: "This analysis has no saved resume text. Upload the resume again." });
    }
    let result;
    try {
      const response = await axios.post(`${ML_URL}/jd-match`, {
        resume_text: analysis.resumeText, jd_text: data.jd_text,
      }, { headers: internalHeaders(), timeout: 30000 });
      result = response.data;
      if (!result || !Number.isFinite(result.overall_match) || result.overall_match < 0 || result.overall_match > 100 ||
          !["Weak", "Fair", "Strong"].includes(result.verdict) ||
          ["matched_skills", "missing_skills", "extra_skills", "keyword_gaps"].some((key) =>
            !Array.isArray(result[key]) || result[key].some((item) => typeof item !== "string"))) {
        return res.status(503).json({ error: "JD matching unavailable" });
      }
    } catch (error) {
      const status = [400, 413, 429].includes(error.response?.status) ? error.response.status : 503;
      return res.status(status).json({ error: "JD matching unavailable" });
    }
    const match = await JDMatch.create({
      userId: req.user._id, analysisId: analysis._id,
      jdTitle: data.jdTitle?.trim() || "Untitled JD",
      jdText: [...data.jd_text].slice(0, 8000).join(""), result,
    });
    res.status(201).json(match);
  } catch {
    res.status(500).json({ error: "Could not save JD match" });
  }
});

app.get("/api/jd-match/history", protect, async (req, res) => {
  try {
    const matches = await JDMatch.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json(matches);
  } catch {
    res.status(500).json({ error: "Could not load JD match history" });
  }
});

app.delete("/api/jd-match/:id", protect, async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: "Invalid match ID" });
  try {
    const match = await JDMatch.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!match) return res.status(404).json({ error: "JD match not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ error: "Could not delete JD match" });
  }
});

// ─── AI Agent proxy ───────────────────────────────────────────
app.post("/api/agent/chat", protect, chatLimit, async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      Object.keys(data).some((key) => !["message", "history"].includes(key)) ||
      typeof data.message !== "string" || !data.message.trim() || [...data.message].length > 2000 ||
      !Array.isArray(data.history) || data.history.some((item) =>
        !item || typeof item !== "object" || Array.isArray(item) ||
        Object.keys(item).length !== 2 ||
        !["user", "assistant"].includes(item.role) ||
        typeof item.content !== "string" || !item.content.trim() ||
        [...item.content].length > (item.role === "assistant" ? 16000 : 2000))) {
    return res.status(400).json({ error: "Invalid chat payload" });
  }
  const payload = {
    message: data.message,
    history: data.history.map(({ role, content }) => ({ role, content })),
  };
  try {
    const response = await axios.post(`${ML_URL}/agent/gap`, payload, {
      headers: internalHeaders(),
      timeout: 30000,
    });
    res.json(response.data);
  } catch (error) {
    const status = [400, 413, 429].includes(error.response?.status) ? error.response.status : 503;
    const safeErrors = [
      "AI quota exhausted or rate limit reached. Try again later.",
      "AI service is not configured. Set GEMINI_API_KEY.",
      "AI request rejected. Check GEMINI_API_KEY and GEMINI_MODEL configuration.",
      "AI service temporarily unavailable. Try again later.",
      "AI returned no text. Try rephrasing your request.",
      "AI returned invalid JSON after one retry.",
    ];
    const message = error.response?.data?.error;
    res.status(status).json({ error: safeErrors.includes(message) ? message : "Agent unavailable" });
  }
});

// ─── ML health check ─────────────────────────────────────────
app.get("/api/ml/health", protect, async (req, res) => {
  try {
    const response = await axios.get(`${ML_URL}/health`, { headers: internalHeaders(), timeout: 10000 });
    res.json(response.data);
  } catch {
    res.status(503).json({ status: "ML service unreachable" });
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.code === "LIMIT_FILE_SIZE" || err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request too large" });
  }
  if (err instanceof multer.MulterError || err.status === 400 || err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid request or upload" });
  }
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
