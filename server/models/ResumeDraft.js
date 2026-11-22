const mongoose = require("mongoose");
const { LIMITS } = require("../lib/resumeBuilder");

// Count Unicode code points, matching the route validation.
const maxChars = (max) => ({ validator: (value) => value == null || [...value].length <= max, message: `Exceeds ${max} characters` });
const str = (max) => ({ type: String, default: "", validate: maxChars(max) });
const strList = (maxItems, max) => ({
  type: [{ type: String, validate: maxChars(max) }],
  validate: { validator: (value) => value.length <= maxItems, message: `At most ${maxItems} items` },
});
const subList = (schema, maxItems) => ({
  type: [schema],
  validate: { validator: (value) => value.length <= maxItems, message: `At most ${maxItems} entries` },
});
const sub = (fields) => new mongoose.Schema(fields, { _id: false });

const resumeDraftSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "Untitled resume", validate: maxChars(LIMITS.title) },
    template: { type: String, enum: ["classic"], default: "classic" },
    sections: {
      contact: {
        name: str(LIMITS.name), email: str(LIMITS.email), phone: str(LIMITS.phone),
        links: strList(LIMITS.links, LIMITS.link),
      },
      summary: str(LIMITS.summary),
      skills: subList(sub({ group: str(LIMITS.group), items: strList(LIMITS.skillItems, LIMITS.skill) }), LIMITS.skillGroups),
      experience: subList(sub({
        role: str(LIMITS.field), org: str(LIMITS.field), start: str(LIMITS.date), end: str(LIMITS.date),
        bullets: strList(LIMITS.bullets, LIMITS.bullet),
      }), LIMITS.entries),
      projects: subList(sub({
        name: str(LIMITS.field), tech: strList(LIMITS.tech, LIMITS.skill), bullets: strList(LIMITS.bullets, LIMITS.bullet),
      }), LIMITS.entries),
      education: subList(sub({
        degree: str(LIMITS.field), institute: str(LIMITS.field), start: str(LIMITS.date), end: str(LIMITS.date),
        score: str(LIMITS.date),
      }), LIMITS.education),
      certifications: strList(LIMITS.listItems, LIMITS.listItem),
      achievements: strList(LIMITS.listItems, LIMITS.listItem),
    },
    atsScore: { type: Number, min: 0, max: 100, default: null },
  },
  { timestamps: true }
);
resumeDraftSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("ResumeDraft", resumeDraftSchema);
