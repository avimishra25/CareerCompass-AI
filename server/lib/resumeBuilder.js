// Resume builder limits and validation, shared by the ResumeDraft schema and the routes.
const LIMITS = {
  title: 120, name: 100, email: 254, phone: 40, links: 5, link: 200,
  summary: 1500, skillGroups: 10, group: 60, skillItems: 30, skill: 60,
  entries: 10, field: 150, date: 30, bullets: 8, bullet: 300, tech: 15,
  education: 6, listItems: 20, listItem: 300, drafts: 20,
};
const SECTIONS = ["experience", "project", "summary"];
const TONES = ["professional", "concise"];

class DraftError extends Error {
  constructor(status) {
    super(status === 413 ? "Draft exceeds size limits" : "Invalid resume draft");
    this.status = status;
  }
}

const length = (value) => [...value].length;
const plainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const object = (value, keys) => {
  if (value === undefined) return {};
  if (!plainObject(value) || Object.keys(value).some((key) => !keys.includes(key))) throw new DraftError(400);
  return value;
};
const text = (value, max) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new DraftError(400);
  if (length(value) > max) throw new DraftError(413);
  return value;
};
const list = (value, maxItems, each) => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new DraftError(400);
  if (value.length > maxItems) throw new DraftError(413);
  return value.map(each);
};
const textList = (value, maxItems, max) => list(value, maxItems, (item) => text(item, max));

// Strictly validate a whole draft body; unknown keys are 400, oversize values 413.
function parseDraft(body) {
  const draft = object(body, ["title", "template", "sections", "atsScore"]);
  if (!plainObject(body)) throw new DraftError(400);
  if (draft.template !== undefined && draft.template !== "classic") throw new DraftError(400);
  if (draft.atsScore !== undefined && draft.atsScore !== null &&
      (!Number.isInteger(draft.atsScore) || draft.atsScore < 0 || draft.atsScore > 100)) throw new DraftError(400);
  const sections = object(draft.sections, ["contact", "summary", "skills", "experience", "projects",
    "education", "certifications", "achievements"]);
  const contact = object(sections.contact, ["name", "email", "phone", "links"]);
  return {
    title: text(draft.title, LIMITS.title).trim() || "Untitled resume",
    template: "classic",
    atsScore: draft.atsScore ?? null,
    sections: {
      contact: {
        name: text(contact.name, LIMITS.name), email: text(contact.email, LIMITS.email),
        phone: text(contact.phone, LIMITS.phone), links: textList(contact.links, LIMITS.links, LIMITS.link),
      },
      summary: text(sections.summary, LIMITS.summary),
      skills: list(sections.skills, LIMITS.skillGroups, (item) => {
        const group = object(item, ["group", "items"]);
        return { group: text(group.group, LIMITS.group), items: textList(group.items, LIMITS.skillItems, LIMITS.skill) };
      }),
      experience: list(sections.experience, LIMITS.entries, (item) => {
        const entry = object(item, ["role", "org", "start", "end", "bullets"]);
        return {
          role: text(entry.role, LIMITS.field), org: text(entry.org, LIMITS.field),
          start: text(entry.start, LIMITS.date), end: text(entry.end, LIMITS.date),
          bullets: textList(entry.bullets, LIMITS.bullets, LIMITS.bullet),
        };
      }),
      projects: list(sections.projects, LIMITS.entries, (item) => {
        const entry = object(item, ["name", "tech", "bullets"]);
        return {
          name: text(entry.name, LIMITS.field), tech: textList(entry.tech, LIMITS.tech, LIMITS.skill),
          bullets: textList(entry.bullets, LIMITS.bullets, LIMITS.bullet),
        };
      }),
      education: list(sections.education, LIMITS.education, (item) => {
        const entry = object(item, ["degree", "institute", "start", "end", "score"]);
        return {
          degree: text(entry.degree, LIMITS.field), institute: text(entry.institute, LIMITS.field),
          start: text(entry.start, LIMITS.date), end: text(entry.end, LIMITS.date), score: text(entry.score, LIMITS.date),
        };
      }),
      certifications: textList(sections.certifications, LIMITS.listItems, LIMITS.listItem),
      achievements: textList(sections.achievements, LIMITS.listItems, LIMITS.listItem),
    },
  };
}

// Validate /enhance input like Flask does; returns null if valid, else the status code.
function enhanceError(data) {
  if (!plainObject(data) || Object.keys(data).length !== 4 ||
      !SECTIONS.includes(data.section) || !TONES.includes(data.tone) ||
      typeof data.title !== "string" || typeof data.notes !== "string" || !data.notes.trim()) return 400;
  if (length(data.title) > LIMITS.title || length(data.notes) > 1500) return 413;
  return null;
}

// Category order mirrors the SKILL_LIST comments in ml-service/app.py; unknown skills go to "Other".
const SKILL_GROUPS = {
  Languages: ["python", "java", "c++", "c#", "javascript", "typescript", "kotlin", "swift", "go", "rust", "ruby",
    "php", "scala", "r", "matlab", "perl", "bash", "shell", "c", "dart", "elixir", "haskell", "lua", "sql", "solidity"],
  Frontend: ["react", "vue", "angular", "nextjs", "nuxtjs", "svelte", "html", "css", "tailwind", "bootstrap", "sass",
    "less", "redux", "zustand", "mobx", "webpack", "vite", "babel", "react query", "framer motion", "three.js", "d3.js"],
  Backend: ["node", "express", "fastapi", "django", "flask", "spring boot", "asp.net", "laravel", "rails", "graphql",
    "rest api", "grpc", "fastify", "hapi", "nestjs", "gin", "fiber", "echo", "microservices"],
  Databases: ["mongodb", "mysql", "postgresql", "sqlite", "redis", "firebase", "cassandra", "dynamodb", "elasticsearch",
    "neo4j", "supabase", "planetscale", "cockroachdb", "influxdb", "snowflake", "bigquery"],
  "Cloud & DevOps": ["docker", "kubernetes", "aws", "azure", "gcp", "terraform", "ansible", "jenkins", "github actions",
    "gitlab ci", "circleci", "linux", "git", "nginx", "apache", "prometheus", "grafana", "datadog", "splunk", "helm",
    "istio", "vault", "ci/cd"],
  "Data & AI": ["machine learning", "deep learning", "pandas", "numpy", "tensorflow", "pytorch", "scikit-learn", "keras",
    "xgboost", "lightgbm", "matplotlib", "seaborn", "plotly", "data science", "nlp", "computer vision",
    "reinforcement learning", "hugging face", "langchain", "openai", "llm", "rag", "vector database", "apache spark",
    "hadoop", "airflow", "dbt", "kafka"],
  Mobile: ["react native", "flutter", "android", "ios", "xamarin", "ionic", "expo"],
  Design: ["figma", "adobe xd", "sketch", "wireframing", "prototyping", "user research", "ui design", "ux design",
    "canva", "illustrator"],
  Security: ["networking", "ethical hacking", "firewalls", "siem", "cryptography", "penetration testing", "owasp",
    "soc", "vulnerability assessment", "cybersecurity", "cloud security"],
  Testing: ["jest", "cypress", "storybook", "tdd", "bdd"],
  Practices: ["agile", "scrum", "kanban", "jira", "confluence", "git flow", "system design",
    "object oriented programming", "functional programming", "design patterns"],
};

function groupSkills(skills) {
  const groups = new Map();
  for (const skill of Array.isArray(skills) ? skills : []) {
    if (typeof skill !== "string" || !skill.trim() || length(skill) > LIMITS.skill) continue;
    const name = Object.keys(SKILL_GROUPS).find((group) => SKILL_GROUPS[group].includes(skill)) || "Other";
    if (!groups.has(name)) groups.set(name, []);
    const items = groups.get(name);
    if (!items.includes(skill) && items.length < LIMITS.skillItems) items.push(skill);
  }
  const order = [...Object.keys(SKILL_GROUPS), "Other"];
  return order.filter((name) => groups.has(name)).map((group) => ({ group, items: groups.get(group) }));
}

// The resume's own Summary/Objective/Profile text, or "" when the resume has none.
function extractSummary(resumeText) {
  if (typeof resumeText !== "string") return "";
  const heading = /^[ \t]*(?:professional |career )?(?:summary|objective|profile|about me)[ \t]*:?[ \t]*$/im.exec(resumeText);
  if (!heading) return "";
  const rest = resumeText.slice(heading.index + heading[0].length);
  const next = /^[ \t]*(?:experience|work experience|education|skills|technical skills|projects?|certifications?|achievements|awards|internships?)[ \t]*:?[ \t]*$/im.exec(rest);
  return [...(next ? rest.slice(0, next.index) : rest).replace(/\s+/g, " ").trim()].slice(0, LIMITS.summary).join("");
}

module.exports = { LIMITS, DraftError, parseDraft, enhanceError, groupSkills, extractSummary };
