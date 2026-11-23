const mongoose = require("mongoose");
const { SESSION_TYPES, QUESTION_TYPES, DIFFICULTIES, TARGET_KINDS, SCORE_KEYS, STATUSES, LIMITS, chars } = require("../lib/interview");

// Length limits count code points, matching the route validation.
const maxChars = (limit) => ({ validator: (value) => value == null || chars(value) <= limit, message: `Exceeds ${limit} characters` });
const score = { type: Number, min: 1, max: 10 };

const questionSchema = new mongoose.Schema(
  {
    qid: { type: String, match: /^q\d{1,2}$/, required: true },
    text: { type: String, validate: maxChars(LIMITS.question), required: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    targets: { type: String, validate: maxChars(LIMITS.targets), required: true },
    targetKind: { type: String, enum: TARGET_KINDS, default: "topic" },
    answer: { type: String, validate: maxChars(LIMITS.answer), default: null },
    scores: {
      type: new mongoose.Schema(Object.fromEntries(SCORE_KEYS.map((key) => [key, { ...score, required: true }])), { _id: false }),
      default: null,
    },
    overall: { ...score, default: null },
    strengths: { type: [{ type: String, validate: maxChars(LIMITS.feedbackItem) }], validate: (value) => value.length <= 3 },
    improvements: { type: [{ type: String, validate: maxChars(LIMITS.feedbackItem) }], validate: (value) => value.length <= 3 },
    modelAnswer: { type: String, validate: maxChars(LIMITS.outline), default: null },
    shortAnswer: { type: Boolean, default: false },
    answeredAt: { type: Date, default: null },
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    analysisId: { type: mongoose.Schema.Types.ObjectId, ref: "Analysis", default: null },
    // Set when the session practises for a saved JD match (its missing skills become the gaps).
    jdMatchId: { type: mongoose.Schema.Types.ObjectId, ref: "JDMatch", default: null },
    role: { type: String, validate: maxChars(LIMITS.role), required: true },
    type: { type: String, enum: SESSION_TYPES, required: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    questions: { type: [questionSchema], validate: (value) => value.length >= 1 && value.length <= LIMITS.questions },
    // Mean of the answered questions' overall scores; null until the first answer.
    overallScore: { ...score, default: null },
    status: { type: String, enum: STATUSES, default: "active" },
  },
  { timestamps: true }
);
interviewSessionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("InterviewSession", interviewSessionSchema);
