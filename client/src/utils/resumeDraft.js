// Pure helpers for the Resume Builder: draft shape, completion checks and plain-text rendering.

export const SECTION_TABS = [
  { key: "contact", label: "Contact" },
  { key: "summary", label: "Summary" },
  { key: "skills", label: "Skills" },
  { key: "projects", label: "Projects" },
  { key: "experience", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "certifications", label: "Certifications" },
  { key: "achievements", label: "Achievements" },
];

export const emptyExperience = () => ({ role: "", org: "", start: "", end: "", bullets: [] });
export const emptyProject = () => ({ name: "", tech: [], bullets: [] });
export const emptyEducation = () => ({ degree: "", institute: "", start: "", end: "", score: "" });
export const emptySkillGroup = () => ({ group: "", items: [] });

export const emptyDraft = () => ({
  _id: null,
  title: "My resume",
  template: "classic",
  atsScore: null,
  sections: {
    contact: { name: "", email: "", phone: "", links: [] },
    summary: "",
    skills: [],
    experience: [emptyExperience()],
    projects: [emptyProject()],
    education: [emptyEducation()],
    certifications: [],
    achievements: [],
  },
});

// Fill any keys a stored draft lacks so the editor never reads undefined.
export function normalizeDraft(draft) {
  const base = emptyDraft();
  const sections = draft?.sections || {};
  return {
    ...base,
    _id: draft?._id || null,
    title: draft?.title || base.title,
    atsScore: draft?.atsScore ?? null,
    sections: {
      ...base.sections,
      ...sections,
      contact: { ...base.sections.contact, ...(sections.contact || {}) },
    },
  };
}

const filled = (value) => typeof value === "string" && value.trim() !== "";
const lines = (items) => (items || []).filter(filled).map((item) => item.trim());

export function isSectionComplete(sections, key) {
  switch (key) {
    case "contact": return filled(sections.contact.name) && (filled(sections.contact.email) || filled(sections.contact.phone));
    case "summary": return filled(sections.summary);
    case "skills": return sections.skills.some((group) => lines(group.items).length);
    case "experience": return sections.experience.some((item) => filled(item.role) && lines(item.bullets).length);
    case "projects": return sections.projects.some((item) => filled(item.name) && lines(item.bullets).length);
    case "education": return sections.education.some((item) => filled(item.degree));
    default: return lines(sections[key]).length > 0;
  }
}

// Strip blank lines and empty entries before saving or rendering.
export function cleanDraft(draft) {
  const s = draft.sections;
  const hasAny = (entry) => Object.values(entry).some((value) => Array.isArray(value) ? lines(value).length : filled(value));
  return {
    title: draft.title,
    template: "classic",
    atsScore: draft.atsScore ?? null,
    sections: {
      contact: { ...s.contact, links: lines(s.contact.links) },
      summary: s.summary.trim(),
      skills: s.skills.map((group) => ({ group: group.group.trim(), items: lines(group.items) })).filter(hasAny),
      experience: s.experience.map((item) => ({ ...item, bullets: lines(item.bullets) })).filter(hasAny),
      projects: s.projects.map((item) => ({ ...item, tech: lines(item.tech), bullets: lines(item.bullets) })).filter(hasAny),
      education: s.education.filter(hasAny),
      certifications: lines(s.certifications),
      achievements: lines(s.achievements),
    },
  };
}

export const dateRange = (start, end) => [start, end].filter(filled).join(" – ");

// Single-column plain text with standard headings: what /score sees and what ATS parsers read.
export function draftToText(draft) {
  const s = cleanDraft(draft).sections;
  const out = [];
  const section = (heading, body) => { if (body.length) out.push("", heading, ...body); };
  if (filled(s.contact.name)) out.push(s.contact.name);
  const contact = [s.contact.email, s.contact.phone, ...s.contact.links].filter(filled);
  if (contact.length) out.push(contact.join(" · "));
  section("SUMMARY", s.summary ? [s.summary] : []);
  section("SKILLS", s.skills.map((group) => (group.group ? `${group.group}: ` : "") + group.items.join(", ")));
  section("EXPERIENCE", s.experience.flatMap((item) => [
    [[item.role, item.org].filter(filled).join(", "), dateRange(item.start, item.end)].filter(filled).join(" | "),
    ...item.bullets.map((bullet) => `- ${bullet}`),
  ]));
  section("PROJECTS", s.projects.flatMap((item) => [
    [item.name, item.tech.join(", ")].filter(filled).join(" · "),
    ...item.bullets.map((bullet) => `- ${bullet}`),
  ]));
  section("EDUCATION", s.education.map((item) =>
    [[item.degree, item.institute].filter(filled).join(", "), dateRange(item.start, item.end), item.score].filter(filled).join(" | ")));
  section("CERTIFICATIONS", s.certifications.map((item) => `- ${item}`));
  section("ACHIEVEMENTS", s.achievements.map((item) => `- ${item}`));
  return out.join("\n").trim();
}
