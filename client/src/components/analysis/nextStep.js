import { roleLabel } from "../../constants/targetRoles";
import { formatSkill } from "../../utils/format";

// Rule-based tips when the ML insights are missing (older analyses).
export function fallbackTips(breakdown = {}) {
  const tips = [];
  if ((breakdown.quantified?.score ?? 0) < 12) tips.push({ label: "Add quantified results", tip: "Add numbers to achievements: percentages, team sizes, users served or time saved." });
  if ((breakdown.verbs?.score ?? 0) < 12) tips.push({ label: "Start bullets with action verbs", tip: "Begin each bullet with a verb such as built, led, reduced or deployed." });
  if ((breakdown.sections?.score ?? 0) < 12) tips.push({ label: "Add missing sections", tip: "Include Summary, Experience, Projects, Skills and Education headings." });
  if ((breakdown.skills?.score ?? 0) < 18) tips.push({ label: "List more relevant skills", tip: "Add a skills section with the languages, frameworks and tools you use." });
  if ((breakdown.length?.words ?? 400) < 300) tips.push({ label: "Add more detail", tip: "Aim for 400–700 words with short project and experience descriptions." });
  return tips.slice(0, 3);
}

export const improvementTips = (mlInsights, breakdown) => (mlInsights?.improve_here?.length ? mlInsights.improve_here : fallbackTips(breakdown));

// The single highest-impact action after an analysis:
// 1. a weak score with a concrete resume fix, 2. missing skills for the role, 3. interview practice.
export function nextStep({ atsScore, mlInsights, atsBreakdown, role, missing = [] }) {
  const tip = improvementTips(mlInsights, atsBreakdown)[0];
  if (atsScore != null && atsScore < 60 && tip) {
    return { kind: "resume", title: tip.label, text: tip.tip, action: "Open resume builder" };
  }
  if (missing.length) {
    const shown = missing.slice(0, 3).map(formatSkill).join(", ");
    return {
      kind: "roadmap",
      title: `Build a roadmap for ${missing.length} missing skill${missing.length === 1 ? "" : "s"}`,
      text: `${roleLabel(role)} roles also ask for ${shown}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}. Get a week-by-week plan to learn them.`,
      action: "Build roadmap",
    };
  }
  return {
    kind: "interview",
    title: `Practise an interview for ${roleLabel(role) || "your target role"}`,
    text: "Your resume covers the core skills for this role. Practise answering questions about them.",
    action: "Practise interview",
  };
}
