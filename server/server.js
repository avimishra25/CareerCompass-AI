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
const CareerRoadmap = require("./models/CareerRoadmap");
const ResumeDraft = require("./models/ResumeDraft");
const { LIMITS: RESUME_LIMITS, DraftError, parseDraft, enhanceError, groupSkills, extractSummary } = require("./lib/resumeBuilder");
const InterviewSession = require("./models/InterviewSession");
const interview = require("./lib/interview");

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
const roadmapLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many roadmap requests. Try again later." },
});
const enhanceLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI suggestions. Try again later." },
});
// The builder rescores after edits (debounced); this caps ML load per user.
const resumeScoreLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Live scoring paused. Try again in a few minutes." },
});
const interviewStartLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many interview sessions started. Try again later." },
});
const interviewAnswerLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many answers submitted. Try again later." },
});
const isObjectId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
// Known-safe ML service messages that may reach the browser; anything else is replaced.
const SAFE_AI_ERRORS = [
  "AI quota exhausted or rate limit reached. Try again later.",
  "AI service is not configured. Set GEMINI_API_KEY.",
  "AI request rejected. Check GEMINI_API_KEY and GEMINI_MODEL configuration.",
  "AI service temporarily unavailable. Try again later.",
  "AI returned no text. Try rephrasing your request.",
  "AI returned invalid JSON after one retry.",
  "AI returned an invalid roadmap. Try again.",
  "AI returned an invalid suggestion. Try again.",
  "AI returned invalid questions. Try again.",
  "AI returned invalid feedback. Try again.",
];
// Must match ROLE_DEFINITIONS in ml-service/app.py (the roles stored in Analysis.match).
const ROADMAP_ROLES = [
  "fullstack developer", "frontend developer", "backend developer", "data scientist",
  "devops engineer", "ml engineer", "mobile developer", "cloud architect",
  "cybersecurity analyst", "ui/ux designer", "database administrator", "blockchain developer",
];
const MILESTONE_STATUSES = ["todo", "progress", "done"];

app.use(cors({
  origin: [
    "https://career-compass-ai-omega-smoky.vercel.app",
    "https://career-compass-ai-git-main-avimishra25s-projects.vercel.app",
    "https://career-compass-5tm4sgjrd-avimishra25s-projects.vercel.app",
    "http://localhost:3000",
  ],
  methods:        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

    // Skills now detected on the resume complete matching roadmap milestones.
    const detectedSkills = Array.isArray(skills) ? skills.filter((skill) => typeof skill === "string") : [];
    if (detectedSkills.length) {
      try {
        await CareerRoadmap.updateMany(
          { userId: req.user._id, "milestones.skill": { $in: detectedSkills } },
          { $set: { "milestones.$[m].status": "done" } },
          { arrayFilters: [{ "m.skill": { $in: detectedSkills }, "m.status": { $ne: "done" } }] },
        );
      } catch (err) {
        console.error("Roadmap progress update failed:", err.message);
      }
    }

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
    const message = error.response?.data?.error;
    res.status(status).json({ error: SAFE_AI_ERRORS.includes(message) ? message : "Agent unavailable" });
  }
});

// ─── Career roadmap ───────────────────────────────────────────
const skillList = (items, limit) => (Array.isArray(items) ? [...items] : [])
  .filter((skill) => typeof skill === "string" && skill.trim() && [...skill].length <= 60)
  .slice(0, limit);
const boundedText = (value, limit) => typeof value === "string" && value.trim() && [...value].length <= limit;

const validRoadmapResult = (data) => {
  if (!data || typeof data !== "object" || typeof data.covered !== "boolean" ||
      !Array.isArray(data.skill_gaps) || data.skill_gaps.length > 100 ||
      data.skill_gaps.some((skill) => !boundedText(skill, 60)) || !Array.isArray(data.milestones)) return false;
  if (data.covered) return data.milestones.length === 0;
  return data.milestones.length >= 4 && data.milestones.length <= 12 && data.milestones.every((item, index) =>
    item && typeof item === "object" && item.week === index + 1 && data.skill_gaps.includes(item.skill) &&
    boundedText(item.objective, 500) && boundedText(item.mini_project, 300) &&
    Array.isArray(item.resources) && item.resources.length >= 2 && item.resources.length <= 3 &&
    item.resources.every((resource) => boundedText(resource, 200)));
};

app.post("/api/roadmap", protect, roadmapLimit, async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      Object.keys(data).some((key) => !["analysisId", "jdMatchId", "targetRole", "hoursPerWeek"].includes(key)) ||
      !isObjectId(data.analysisId) ||
      (data.jdMatchId !== undefined && data.jdMatchId !== null && !isObjectId(data.jdMatchId)) ||
      (data.targetRole !== undefined && !ROADMAP_ROLES.includes(data.targetRole)) ||
      !Number.isInteger(data.hoursPerWeek) || data.hoursPerWeek < 2 || data.hoursPerWeek > 40) {
    return res.status(400).json({ error: "Invalid roadmap payload" });
  }
  try {
    const analysis = await Analysis.findOne({ _id: data.analysisId, user: req.user._id }).select("+resumeText");
    if (!analysis) return res.status(404).json({ error: "Analysis not found" });
    let jdMatch = null;
    if (data.jdMatchId) {
      jdMatch = await JDMatch.findOne({ _id: data.jdMatchId, userId: req.user._id });
      if (!jdMatch) return res.status(404).json({ error: "JD match not found" });
    }
    const targetRole = data.targetRole ||
      (ROADMAP_ROLES.includes(analysis.targetRole) ? analysis.targetRole : analysis.bestRole?.role);
    const roleMatch = typeof analysis.match?.get === "function" ? analysis.match.get(targetRole) : analysis.match?.[targetRole];
    if (!ROADMAP_ROLES.includes(targetRole) || !Array.isArray(roleMatch?.missing)) {
      return res.status(400).json({ error: "Choose a target role for this analysis" });
    }
    const payload = {
      target_role: targetRole,
      missing_skills: skillList(roleMatch.missing, 50),
      jd_gaps: skillList(jdMatch?.result?.missing_skills, 50),
      known_skills: skillList(analysis.skills, 300),
      hours_per_week: data.hoursPerWeek,
    };
    // Lets the plan extend the student's own projects; older analyses have no saved text.
    if (typeof analysis.resumeText === "string" && analysis.resumeText.trim()) {
      payload.resume_text = analysis.resumeText.slice(0, 50000);
    }
    let result;
    try {
      const response = await axios.post(`${ML_URL}/roadmap`, payload, { headers: internalHeaders(), timeout: 90000 });
      result = response.data;
      if (!validRoadmapResult(result)) return res.status(503).json({ error: "Roadmap generation unavailable" });
    } catch (error) {
      const status = [400, 413, 429, 502].includes(error.response?.status) ? error.response.status : 503;
      const message = error.response?.data?.error;
      return res.status(status).json({ error: SAFE_AI_ERRORS.includes(message) ? message : "Roadmap generation unavailable" });
    }
    const roadmap = await CareerRoadmap.create({
      userId: req.user._id, analysisId: analysis._id, jdMatchId: jdMatch?._id || null, targetRole,
      hoursPerWeek: data.hoursPerWeek, skillGaps: result.skill_gaps, covered: result.covered,
      milestones: result.milestones.map(({ week, skill, objective, resources, mini_project }) => ({
        week, skill, objective, resources, miniProject: mini_project,
      })),
    });
    res.status(201).json(roadmap);
  } catch {
    res.status(500).json({ error: "Could not save roadmap" });
  }
});

app.get("/api/roadmap", protect, async (req, res) => {
  try {
    const roadmap = await CareerRoadmap.findOne({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json(roadmap || null);
  } catch {
    res.status(500).json({ error: "Could not load roadmap" });
  }
});

app.get("/api/roadmap/:id", protect, async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ error: "Invalid roadmap ID" });
  try {
    const roadmap = await CareerRoadmap.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!roadmap) return res.status(404).json({ error: "Roadmap not found" });
    res.json(roadmap);
  } catch {
    res.status(500).json({ error: "Could not load roadmap" });
  }
});

app.patch("/api/roadmap/:id/milestone/:mid", protect, async (req, res) => {
  const data = req.body;
  if (!isObjectId(req.params.id) || !isObjectId(req.params.mid) ||
      !data || typeof data !== "object" || Array.isArray(data) ||
      Object.keys(data).length !== 1 || !MILESTONE_STATUSES.includes(data.status)) {
    return res.status(400).json({ error: "Invalid milestone update" });
  }
  try {
    const roadmap = await CareerRoadmap.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, "milestones._id": req.params.mid },
      { $set: { "milestones.$.status": data.status } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!roadmap) return res.status(404).json({ error: "Milestone not found" });
    res.json(roadmap);
  } catch {
    res.status(500).json({ error: "Could not update milestone" });
  }
});

// ─── AI Resume Builder ────────────────────────────────────────
const DRAFT_LIST_FIELDS = "title template atsScore createdAt updatedAt";

app.get("/api/resume-builder/drafts", protect, async (req, res) => {
  try {
    const drafts = await ResumeDraft.find({ userId: req.user._id }).select(DRAFT_LIST_FIELDS).sort({ updatedAt: -1 }).lean();
    res.json(drafts);
  } catch {
    res.status(500).json({ error: "Could not load drafts" });
  }
});

app.post("/api/resume-builder/drafts", protect, async (req, res) => {
  let draft;
  try {
    draft = parseDraft(req.body);
  } catch (error) {
    if (error instanceof DraftError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
  try {
    if (await ResumeDraft.countDocuments({ userId: req.user._id }) >= RESUME_LIMITS.drafts) {
      return res.status(409).json({ error: `You can keep up to ${RESUME_LIMITS.drafts} drafts. Delete one first.` });
    }
    const saved = await ResumeDraft.create({ ...draft, userId: req.user._id });
    res.status(201).json(saved);
  } catch {
    res.status(500).json({ error: "Could not save draft" });
  }
});

app.get("/api/resume-builder/drafts/:id", protect, async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ error: "Invalid draft ID" });
  try {
    const draft = await ResumeDraft.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!draft) return res.status(404).json({ error: "Draft not found" });
    res.json(draft);
  } catch {
    res.status(500).json({ error: "Could not load draft" });
  }
});

app.put("/api/resume-builder/drafts/:id", protect, async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ error: "Invalid draft ID" });
  let draft;
  try {
    draft = parseDraft(req.body);
  } catch (error) {
    if (error instanceof DraftError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
  try {
    const saved = await ResumeDraft.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: draft },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!saved) return res.status(404).json({ error: "Draft not found" });
    res.json(saved);
  } catch {
    res.status(500).json({ error: "Could not save draft" });
  }
});

app.delete("/api/resume-builder/drafts/:id", protect, async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ error: "Invalid draft ID" });
  try {
    const draft = await ResumeDraft.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!draft) return res.status(404).json({ error: "Draft not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ error: "Could not delete draft" });
  }
});

app.post("/api/resume-builder/enhance", protect, enhanceLimit, async (req, res) => {
  const invalid = enhanceError(req.body);
  if (invalid) return res.status(invalid).json({ error: invalid === 413 ? "Notes exceed 1500 or title 120 characters" : "Invalid enhance payload" });
  const { section, title, notes, tone } = req.body;
  try {
    const response = await axios.post(`${ML_URL}/resume/enhance`, { section, title, notes, tone }, {
      headers: internalHeaders(), timeout: 60000,
    });
    const bullets = response.data?.bullets;
    if (!Array.isArray(bullets) || bullets.length < 2 || bullets.length > 4 ||
        bullets.some((bullet) => !boundedText(bullet, 220))) {
      return res.status(503).json({ error: "Resume enhancement unavailable" });
    }
    res.json({ bullets: [...bullets] });
  } catch (error) {
    const status = [400, 413, 429, 502].includes(error.response?.status) ? error.response.status : 503;
    const message = error.response?.data?.error;
    res.status(status).json({ error: SAFE_AI_ERRORS.includes(message) ? message : "Resume enhancement unavailable" });
  }
});

app.post("/api/resume-builder/score", protect, resumeScoreLimit, async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).length !== 1 ||
      typeof data.text !== "string" || !data.text.trim()) {
    return res.status(400).json({ error: "Invalid score payload" });
  }
  if ([...data.text].length > 50000) return res.status(413).json({ error: "Resume text exceeds 50000 characters" });
  try {
    const response = await axios.post(`${ML_URL}/resume/score`, { text: data.text }, {
      headers: internalHeaders(), timeout: 30000,
    });
    const { ats_score: atsScore, ats_breakdown: atsBreakdown, ml_insights: mlInsights } = response.data || {};
    if (!Number.isInteger(atsScore) || atsScore < 0 || atsScore > 100 ||
        !atsBreakdown || typeof atsBreakdown !== "object" || Object.values(atsBreakdown).some((item) =>
          !item || !Number.isFinite(item.score) || !Number.isFinite(item.max) || typeof item.label !== "string")) {
      return res.status(503).json({ error: "Scoring unavailable" });
    }
    res.json({ atsScore, atsBreakdown, mlInsights: mlInsights ?? null });
  } catch (error) {
    const status = [400, 413, 429].includes(error.response?.status) ? error.response.status : 503;
    res.status(status).json({ error: "Scoring unavailable" });
  }
});

app.post("/api/resume-builder/import", protect, async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).length !== 1 || !isObjectId(data.analysisId)) {
    return res.status(400).json({ error: "Invalid import payload" });
  }
  try {
    const analysis = await Analysis.findOne({ _id: data.analysisId, user: req.user._id }).select("+resumeText");
    if (!analysis) return res.status(404).json({ error: "Analysis not found" });
    const skills = groupSkills(analysis.skills ? [...analysis.skills] : []).slice(0, RESUME_LIMITS.skillGroups);
    let summary = extractSummary(analysis.resumeText);
    let summarySource = "resume";
    if (!summary) {
      // Built only from analysis facts (role + detected skills), never invented experience.
      const role = analysis.targetRole || analysis.bestRole?.role;
      const top = skills.flatMap((group) => group.items).slice(0, 5);
      summary = role && top.length ? `Candidate targeting ${role} roles, with skills in ${top.join(", ")}.` : "";
      summarySource = summary ? "analysis" : "none";
    }
    res.json({ analysisId: analysis._id, resumeName: analysis.resumeName, summarySource, sections: { summary, skills } });
  } catch {
    res.status(500).json({ error: "Could not import analysis" });
  }
});

// ─── Interview prep ───────────────────────────────────────────
const INTERVIEW_QUESTION_COUNT = 5;
// The history list never includes answers or feedback text.
const SESSION_LIST_FIELDS = "role type difficulty status overallScore createdAt updatedAt questions.qid questions.overall questions.answeredAt";
const QID = /^q\d{1,2}$/;
const aiFailure = (res, error, fallback) => {
  const status = [400, 413, 429, 502].includes(error.response?.status) ? error.response.status : 503;
  const message = error.response?.data?.error;
  res.status(status).json({ error: SAFE_AI_ERRORS.includes(message) ? message : fallback });
};

app.post("/api/interview/start", protect, interviewStartLimit, async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      Object.keys(data).some((key) => !["role", "type", "difficulty", "analysisId"].includes(key)) ||
      !ROADMAP_ROLES.includes(data.role) || !interview.SESSION_TYPES.includes(data.type) ||
      !interview.DIFFICULTIES.includes(data.difficulty) ||
      (data.analysisId !== undefined && data.analysisId !== null && !isObjectId(data.analysisId))) {
    return res.status(400).json({ error: "Invalid interview payload" });
  }
  try {
    // An explicit analysis must be the caller's; otherwise use their latest one (or none).
    const analysis = data.analysisId
      ? await Analysis.findOne({ _id: data.analysisId, user: req.user._id }).select("+resumeText")
      : await Analysis.findOne({ user: req.user._id }).sort({ createdAt: -1 }).select("+resumeText");
    if (data.analysisId && !analysis) return res.status(404).json({ error: "Analysis not found" });
    const roleMatch = typeof analysis?.match?.get === "function" ? analysis.match.get(data.role) : analysis?.match?.[data.role];
    const skills = skillList(analysis?.skills, interview.LIMITS.skills);
    const known = new Set(skills.map((skill) => skill.toLowerCase()));
    const payload = {
      role: data.role, type: data.type, difficulty: data.difficulty, resume_skills: skills,
      gaps: skillList(roleMatch?.missing, interview.LIMITS.gaps).filter((skill) => !known.has(skill.toLowerCase())),
      projects: interview.extractProjectTitles(analysis?.resumeText), count: INTERVIEW_QUESTION_COUNT,
    };
    let questions;
    try {
      const response = await axios.post(`${ML_URL}/interview/questions`, payload, { headers: internalHeaders(), timeout: 60000 });
      if (!interview.validQuestions(response.data, data.type, INTERVIEW_QUESTION_COUNT)) {
        return res.status(503).json({ error: "Interview questions unavailable" });
      }
      questions = response.data.questions;
    } catch (error) {
      return aiFailure(res, error, "Interview questions unavailable");
    }
    const session = await InterviewSession.create({
      userId: req.user._id, analysisId: analysis?._id || null, role: data.role, type: data.type, difficulty: data.difficulty,
      questions: questions.map(({ id, text, type, targets, target_kind }) => ({ qid: id, text, type, targets, targetKind: target_kind })),
    });
    res.status(201).json(session);
  } catch {
    res.status(500).json({ error: "Could not start interview session" });
  }
});

app.get("/api/interview/history", protect, async (req, res) => {
  try {
    const sessions = await InterviewSession.find({ userId: req.user._id }).select(SESSION_LIST_FIELDS)
      .sort({ createdAt: -1 }).limit(50).lean();
    res.json(sessions);
  } catch {
    res.status(500).json({ error: "Could not load interview history" });
  }
});

app.get("/api/interview/:id", protect, async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ error: "Invalid session ID" });
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  } catch {
    res.status(500).json({ error: "Could not load session" });
  }
});

app.post("/api/interview/:id/answer", protect, interviewAnswerLimit, async (req, res) => {
  const data = req.body;
  if (!isObjectId(req.params.id) || !data || typeof data !== "object" || Array.isArray(data) ||
      Object.keys(data).length !== 2 || typeof data.qid !== "string" || !QID.test(data.qid) ||
      typeof data.answer !== "string") {
    return res.status(400).json({ error: "Invalid answer payload" });
  }
  if (interview.chars(data.answer) > interview.LIMITS.answer) {
    return res.status(413).json({ error: `Answer exceeds ${interview.LIMITS.answer} characters` });
  }
  const answer = data.answer.trim();
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    const question = session?.questions.find((item) => item.qid === data.qid);
    if (!question) return res.status(404).json({ error: session ? "Question not found" : "Session not found" });
    if (question.answeredAt) return res.status(409).json({ error: "This question is already answered" });
    let feedback;
    try {
      const response = await axios.post(`${ML_URL}/interview/evaluate`,
        { question: question.text, type: question.type, role: session.role, answer },
        { headers: internalHeaders(), timeout: 30000 });
      feedback = interview.parseFeedback(response.data);
      if (!feedback) return res.status(503).json({ error: "Answer evaluation unavailable" });
    } catch (error) {
      return aiFailure(res, error, "Answer evaluation unavailable");
    }
    // Only an unanswered question is updated, so a double submit cannot overwrite feedback.
    const set = Object.fromEntries(Object.entries({ answer, ...feedback, answeredAt: new Date() })
      .map(([key, value]) => [`questions.$.${key}`, value]));
    const updated = await InterviewSession.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, questions: { $elemMatch: { qid: data.qid, answeredAt: null } } },
      { $set: set },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) return res.status(409).json({ error: "This question is already answered" });
    const answered = updated.questions.filter((item) => item.answeredAt);
    const saved = await InterviewSession.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: {
        overallScore: interview.mean(answered.map((item) => item.overall)),
        status: answered.length === updated.questions.length ? "completed" : "active",
      } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    res.json(saved);
  } catch {
    res.status(500).json({ error: "Could not save answer" });
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
