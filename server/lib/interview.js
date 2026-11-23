// Interview prep: limits and validators shared by the routes and the InterviewSession schema.
const SESSION_TYPES = ["technical", "hr", "behavioural", "mixed"];
const QUESTION_TYPES = ["technical", "hr", "behavioural"];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const TARGET_KINDS = ["gap", "project", "skill", "topic"];
const SCORE_KEYS = ["relevance", "technical_accuracy", "structure", "clarity", "depth"];
const STATUSES = ["active", "completed"];

const LIMITS = {
  role: 100, question: 300, targets: 120, answer: 4000, feedbackItem: 300, outline: 300,
  questions: 5, skills: 300, gaps: 50, skill: 60, projects: 5, projectTitle: 80,
};

const chars = (value) => [...value].length;
const bounded = (value, limit) => typeof value === "string" && value.trim() !== "" && chars(value) <= limit;
const round1 = (value) => Math.round(value * 10) / 10;
const mean = (values) => (values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

const PROJECT_HEADING = /^[ \t]*(?:personal |academic |key |selected )?projects?[ \t]*:?[ \t]*$/im;
const NEXT_HEADING = /^[ \t]*(?:experience|work experience|employment|education|skills|technical skills|certifications?|achievements|awards|publications|languages|interests|summary|internships?)[ \t]*:?[ \t]*$/im;
const BULLET = /^[•▪◦●○■□➢►✓*·–—-]/;

// Project titles are the non-bullet lines of the Projects section, cut at the first " - ", " | ",
// ": " or "(" (tech stack, dates). Lines that read like sentences or wrapped bullets are skipped.
function extractProjectTitles(resumeText) {
  if (typeof resumeText !== "string") return [];
  const heading = PROJECT_HEADING.exec(resumeText);
  if (!heading) return [];
  const rest = resumeText.slice(heading.index + heading[0].length);
  const next = NEXT_HEADING.exec(rest);
  const titles = [];
  for (const raw of (next ? rest.slice(0, next.index) : rest).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || BULLET.test(line) || /^[a-z]/.test(line) || /[.,;]$/.test(line)) continue;
    const title = line.split(/\s+[-–—|]\s+|\s*\|\s*|:\s|\s*\(/)[0].trim();
    if (chars(title) < 3 || chars(title) > LIMITS.projectTitle || !/[a-z]/i.test(title) ||
        title.split(/\s+/).length > 8 || titles.some((item) => item.toLowerCase() === title.toLowerCase())) continue;
    titles.push(title);
    if (titles.length === LIMITS.projects) break;
  }
  return titles;
}

// Shape check for Flask /interview/questions output.
function validQuestions(data, sessionType, count) {
  const types = sessionType === "mixed" ? QUESTION_TYPES : [sessionType];
  return Boolean(data) && Array.isArray(data.questions) && data.questions.length === count &&
    data.questions.every((item, index) => item && typeof item === "object" && item.id === `q${index + 1}` &&
      bounded(item.text, LIMITS.question) && types.includes(item.type) &&
      bounded(item.targets, LIMITS.targets) && TARGET_KINDS.includes(item.target_kind));
}

// Validate Flask /interview/evaluate output and return clean fields. The overall score is
// recomputed here from the five rubric scores, so neither the model nor Flask is trusted for it.
function parseFeedback(data) {
  if (!data || typeof data !== "object") return null;
  const scores = data.scores;
  if (!scores || typeof scores !== "object" || Object.keys(scores).length !== SCORE_KEYS.length ||
      !SCORE_KEYS.every((key) => Number.isInteger(scores[key]) && scores[key] >= 1 && scores[key] <= 10)) return null;
  const shortAnswer = data.short_answer === true;
  const list = (value, min) => Array.isArray(value) && value.length >= min && value.length <= 3 &&
    value.every((item) => bounded(item, LIMITS.feedbackItem));
  // Short answers are scored without the LLM, so they have no strengths.
  if (!list(data.strengths, shortAnswer ? 0 : 1) || !list(data.improvements, 1) ||
      !bounded(data.model_answer_outline, LIMITS.outline)) return null;
  const clean = Object.fromEntries(SCORE_KEYS.map((key) => [key, scores[key]]));
  return {
    scores: clean, overall: mean(Object.values(clean)), strengths: [...data.strengths],
    improvements: [...data.improvements], modelAnswer: data.model_answer_outline, shortAnswer,
  };
}

module.exports = {
  SESSION_TYPES, QUESTION_TYPES, DIFFICULTIES, TARGET_KINDS, SCORE_KEYS, STATUSES, LIMITS,
  chars, mean, extractProjectTitles, validQuestions, parseFeedback,
};
