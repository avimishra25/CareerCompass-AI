const mongoose = require("mongoose");

const analysisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    skills: [String],
    bestRole: {
      role: String,
      score: Number,
    },
    match: {
      type: Map,
      of: new mongoose.Schema(
        {
          score: String,
          missing: [String],
          emoji: String,
        },
        { _id: false }
      ),
    },
    resumeName: {
      type: String,
      default: "resume.pdf",
    },
    // ── Existing fields ──
    targetRole: {
      type: String,
      default: null,
    },
    atsScore: {
      type: Number,
      default: null,
    },
    atsBreakdown: {
      type: Object,
      default: {},
    },
    // ── New: ML model insights ──
    // Stores the GradientBoostingRegressor output:
    // top_drivers (what scored well) and improve_here
    // (what to fix), plus the raw feature values.
    mlInsights: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Analysis", analysisSchema);
