const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema({
  week: { type: Number, min: 1, max: 12, required: true },
  skill: { type: String, maxlength: 60, required: true },
  // "Skill: subtopic" (e.g. "REST API: routing and status codes"). Older roadmaps have none.
  title: { type: String, maxlength: 120, default: "" },
  objective: { type: String, maxlength: 500, required: true },
  resources: {
    type: [{ type: String, maxlength: 200 }],
    validate: (value) => value.length >= 2 && value.length <= 3,
  },
  miniProject: { type: String, maxlength: 300, required: true },
  status: { type: String, enum: ["todo", "progress", "done"], default: "todo" },
});

const careerRoadmapSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    analysisId: { type: mongoose.Schema.Types.ObjectId, ref: "Analysis", required: true },
    jdMatchId: { type: mongoose.Schema.Types.ObjectId, ref: "JDMatch", default: null },
    targetRole: { type: String, maxlength: 100, required: true },
    hoursPerWeek: { type: Number, min: 2, max: 40, required: true },
    // Ordered (prerequisites first) gaps the plan was built from; drives "remaining gaps".
    skillGaps: { type: [{ type: String, maxlength: 60 }], validate: (value) => value.length <= 100 },
    covered: { type: Boolean, default: false },
    milestones: { type: [milestoneSchema], validate: (value) => value.length <= 12 },
  },
  { timestamps: true }
);
careerRoadmapSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("CareerRoadmap", careerRoadmapSchema);
