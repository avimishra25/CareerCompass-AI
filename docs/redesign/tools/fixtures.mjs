// Realistic API fixtures shaped exactly like the Node responses, for screenshots only.
const ROLES = {
  "fullstack developer": ["💻", 78, ["sql", "git"]],
  "backend developer": ["⚙️", 72, ["docker", "postgresql"]],
  "frontend developer": ["🎨", 64, ["typescript", "tailwind", "redux"]],
  "data scientist": ["📊", 41, ["pandas", "numpy", "tensorflow", "matplotlib", "scikit-learn"]],
  "ml engineer": ["🤖", 33, ["tensorflow", "pytorch", "deep learning", "mlops", "numpy", "docker"]],
  "devops engineer": ["🔧", 30, ["docker", "kubernetes", "aws", "ci/cd", "terraform", "ansible"]],
  "cloud architect": ["☁️", 22, ["aws", "azure", "gcp", "docker", "kubernetes", "terraform", "networking"]],
  "mobile developer": ["📱", 18, ["react native", "flutter", "android", "ios", "kotlin", "swift"]],
  "ui/ux designer": ["✏️", 29, ["figma", "wireframing", "prototyping", "user research", "adobe xd"]],
  "cybersecurity analyst": ["🔐", 14, ["networking", "ethical hacking", "firewalls", "cryptography", "siem", "linux"]],
  "database administrator": ["🗄️", 25, ["postgresql", "mysql", "redis", "elasticsearch", "backup", "replication"]],
  "blockchain developer": ["🔗", 9, ["solidity", "ethereum", "web3", "smart contracts", "cryptography"]],
};
const match = Object.fromEntries(Object.entries(ROLES).map(([role, [emoji, score, missing]]) => [role, { score: String(score), missing, emoji }]));
const skills = ["javascript", "react", "node", "express", "mongodb", "html", "css", "python", "flask", "rest api", "jwt", "tailwind"];
const atsBreakdown = {
  skills: { score: 18, max: 30, label: "Skill coverage" },
  verbs: { score: 12, max: 20, label: "Action verbs", found: ["built", "developed", "designed", "implemented", "led", "deployed"] },
  quantified: { score: 8, max: 20, label: "Quantified results" },
  sections: { score: 16, max: 20, label: "Resume sections" },
  length: { score: 10, max: 10, label: "Length & density", words: 512 },
};
const mlInsights = {
  model: "GradientBoostingRegressor",
  features: { skill_count: 12, skill_density: 2.3, unique_verb_count: 6, verb_density: 1.2, quant_count: 2, section_count: 8, word_count: 512, avg_sentence_len: 14.2, has_contact: 1, has_summary: 1 },
  top_drivers: [
    { feature: "skill_count", label: "Number of skills", importance: 31.4, your_value: 12 },
    { feature: "section_count", label: "Resume sections", importance: 18.2, your_value: 8 },
    { feature: "unique_verb_count", label: "Action verbs used", importance: 14.9, your_value: 6 },
  ],
  improve_here: [
    { feature: "quant_count", label: "Quantified results", tip: "Add numbers to your achievements: percentages, team sizes, revenue impact." },
    { feature: "has_summary", label: "Professional summary", tip: "Add a 2–3 sentence professional summary at the top of your resume." },
  ],
};

export const user = { _id: "u1", name: "Rahul Verma", email: "rahul.verma@example.com" };
const analysis = (id, name, ats, date, extra = {}) => ({
  _id: id, user: "u1", skills, match, bestRole: { role: "fullstack developer", score: 78 }, resumeName: name,
  targetRole: "fullstack developer", atsScore: ats, atsBreakdown, mlInsights, createdAt: date, updatedAt: date, ...extra,
});
export const history = [
  analysis("a3", "Rahul_Verma_Resume_v3.pdf", 72, "2026-11-20T10:12:00.000Z"),
  analysis("a2", "Rahul_Verma_Resume_v2.pdf", 64, "2026-11-02T15:40:00.000Z", { skills: skills.slice(0, 9), atsScore: 64 }),
  analysis("a1", "resume_final.pdf", 51, "2026-10-14T09:05:00.000Z", { skills: skills.slice(0, 6), targetRole: null }),
];
export const upload = {
  analysisId: "a3", skills, match, bestRole: { role: "fullstack developer", score: 78 }, atsScore: 72, atsBreakdown, mlInsights,
  targetRoleAnalysis: { role: "fullstack developer", score: 78, missing: ["sql", "git"], emoji: "💻" },
};
const jd = (id, title, score, verdict, date, missing) => ({
  _id: id, userId: "u1", analysisId: "a3", jdTitle: title, createdAt: date,
  result: { overall_match: score, verdict, matched_skills: ["react", "node", "express", "mongodb", "rest api"], missing_skills: missing,
    extra_skills: ["flask", "python"], keyword_gaps: ["microservices", "unit testing", "agile"] },
});
export const jdMatches = [
  jd("j1", "Software Engineer Intern, Payments", 74, "Strong", "2026-11-21T08:00:00.000Z", ["typescript", "docker", "redis"]),
  jd("j2", "Backend Developer, Logistics", 52, "Fair", "2026-11-12T08:00:00.000Z", ["postgresql", "docker", "kafka", "aws"]),
];
const milestone = (n, skill, status, objective) => ({ _id: `m${n}`, week: n, skill, status, objective,
  resources: [`${skill} official docs`, "freeCodeCamp course"], miniProject: `Add ${skill} to the Expense Tracker project` });
export const roadmap = {
  _id: "r1", userId: "u1", analysisId: "a3", jdMatchId: null, targetRole: "fullstack developer", hoursPerWeek: 8, covered: false,
  skillGaps: ["git", "sql", "typescript", "docker"], createdAt: "2026-11-20T11:00:00.000Z",
  milestones: [
    milestone(1, "git", "done", "Branching, rebasing and pull requests on a team repository."),
    milestone(2, "sql", "done", "SELECT, JOIN and GROUP BY on a sample dataset; design one normalised schema."),
    milestone(3, "sql", "progress", "Indexes, transactions and migrating Expense Tracker's reports to PostgreSQL."),
    milestone(4, "typescript", "todo", "Types, interfaces and generics; convert one React component."),
    milestone(5, "typescript", "todo", "Strict mode across the frontend and typed API responses."),
    milestone(6, "docker", "todo", "Containerise the Node API and run it with Docker Compose."),
  ],
};
export const summary = {
  analyses: { count: 3, averageAts: 62, latestAts: 72, topRole: "fullstack developer", latestAnalysisId: "a3", latestAnalysisAt: "2026-11-20T10:12:00.000Z" },
  jdMatches: { count: 2, best: 74 },
  roadmap: { id: "r1", targetRole: "fullstack developer", covered: false, total: 6, done: 2, completion: 33,
    nextMilestone: { week: 3, skill: "sql", objective: roadmap.milestones[2].objective, status: "progress" } },
  interview: { readiness: 6.8, sessions: 3, change: null, lastScore: 7.0 },
};
const q = (qid, text, type, targets, targetKind, extra = {}) => ({
  qid, text, type, targets, targetKind, answer: null, scores: null, overall: null, strengths: [], improvements: [],
  modelAnswer: null, shortAnswer: false, answeredAt: null, ...extra,
});
export const session = {
  _id: "s3", userId: "u1", role: "fullstack developer", type: "mixed", difficulty: "intermediate", status: "active", overallScore: 7,
  createdAt: "2026-11-22T09:00:00.000Z",
  questions: [
    q("q1", "Explain how JWT authentication works in your Expense Tracker project.", "technical", "Expense Tracker", "project", {
      answer: "The server signs a token with the user id after login. The client stores it and sends it in the Authorization header; middleware verifies the signature and expiry on each request before loading the user.",
      scores: { relevance: 8, technical_accuracy: 7, structure: 6, clarity: 8, depth: 6 }, overall: 7,
      strengths: ["Correctly describes signing and verification.", "Mentions expiry checks in middleware."],
      improvements: ["Explain where the token is stored and the XSS trade-off.", "Mention refresh tokens or rotation."],
      modelAnswer: "Login → sign JWT (id, expiry) → client storage choice → Authorization header → verify middleware → refresh strategy.",
      answeredAt: "2026-11-22T09:05:00.000Z",
    }),
    q("q2", "How would you design the database schema for monthly reports if you moved Expense Tracker to SQL?", "technical", "sql", "gap"),
    q("q3", "REST vs GraphQL: when would you choose each for a dashboard API?", "technical", "rest api", "skill"),
    q("q4", "Tell me about a time you resolved a disagreement in a team project.", "behavioural", "teamwork", "topic"),
    q("q5", "How would you containerise and deploy a MERN app?", "technical", "docker", "gap"),
  ],
};
export const interviewHistory = [
  { _id: "s3", role: "fullstack developer", type: "mixed", difficulty: "intermediate", status: "active", overallScore: 7, createdAt: "2026-11-22T09:00:00.000Z",
    questions: session.questions.map(({ qid, overall, answeredAt }) => ({ qid, overall, answeredAt })) },
  { _id: "s2", role: "fullstack developer", type: "technical", difficulty: "intermediate", status: "completed", overallScore: 6.8, createdAt: "2026-11-15T09:00:00.000Z", questions: [] },
  { _id: "s1", role: "fullstack developer", type: "hr", difficulty: "beginner", status: "completed", overallScore: 6.6, createdAt: "2026-11-08T09:00:00.000Z", questions: [] },
];
export const draft = {
  _id: "d1", title: "Fullstack internship resume", template: "classic", atsScore: 68, updatedAt: "2026-11-21T12:00:00.000Z",
  sections: {
    contact: { name: "Rahul Verma", email: "rahul.verma@example.com", phone: "+91 98765 43210", links: ["github.com/rahulverma", "linkedin.com/in/rahulverma"] },
    summary: "Computer science student building full-stack web apps with React, Node and MongoDB. Looking for a summer 2027 software engineering internship.",
    skills: [{ group: "Languages", items: ["JavaScript", "Python", "SQL"] }, { group: "Frontend", items: ["React", "Tailwind CSS", "HTML", "CSS"] },
      { group: "Backend", items: ["Node.js", "Express", "Flask", "REST APIs"] }, { group: "Databases", items: ["MongoDB", "PostgreSQL"] }],
    experience: [{ role: "Web Development Intern", org: "Brightpath Labs", start: "May 2026", end: "Jul 2026",
      bullets: ["Built 6 reusable React components for the customer dashboard used by 1,200 users", "Reduced API response time by 30% by adding MongoDB indexes"] }],
    projects: [{ name: "Expense Tracker", tech: ["React", "Node", "MongoDB"], bullets: ["Developed a budgeting app with JWT authentication and monthly reports", "Deployed on Render with a CI pipeline in GitHub Actions"] }],
    education: [{ degree: "B.Tech, Computer Science", institute: "Delhi Technological University", start: "2023", end: "2027", score: "CGPA 8.6" }],
    certifications: ["AWS Cloud Practitioner"], achievements: ["Finalist, Smart India Hackathon 2025"],
  },
};
export const draftList = [{ _id: "d1", title: draft.title, template: "classic", atsScore: 68, createdAt: draft.updatedAt, updatedAt: draft.updatedAt }];
export const score = { atsScore: 68, atsBreakdown, mlInsights };
