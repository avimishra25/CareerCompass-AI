const mongoose = require("mongoose");

const jdMatchSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  analysisId: { type: mongoose.Schema.Types.ObjectId, ref: "Analysis", required: true },
  jdTitle: { type: String, maxlength: 120, default: "Untitled JD" },
  jdText: { type: String, required: true, validate: (value) => [...value].length <= 8000 },
  result: {
    overall_match: { type: Number, min: 0, max: 100, required: true },
    matched_skills: [String],
    missing_skills: [String],
    extra_skills: [String],
    keyword_gaps: [String],
    verdict: { type: String, enum: ["Weak", "Fair", "Strong"], required: true },
  },
  createdAt: { type: Date, default: Date.now },
});
jdMatchSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("JDMatch", jdMatchSchema);
