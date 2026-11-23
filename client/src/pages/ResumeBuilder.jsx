import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  SECTION_TABS, cleanDraft, dateRange, draftToText, emptyDraft, emptyEducation, emptyExperience, emptyProject,
  emptySkillGroup, isSectionComplete, normalizeDraft,
} from "../utils/resumeDraft";
import { exportResumePdf } from "../utils/resumePdf";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const errorMessage = (error, fallback) => error.response?.data?.error || error.response?.data?.message || fallback;

const font = "Plus Jakarta Sans, sans-serif";
const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)" };
const okPill = { display: "inline-block", background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.22)", color: "#059669" };
const missPill = { display: "inline-block", background: "rgba(244,63,126,0.07)", borderColor: "rgba(244,63,126,0.2)", color: "#e11d63" };
const activePill = { display: "inline-block", background: "linear-gradient(135deg,#3b6ef8,#6c63ff)", borderColor: "transparent", color: "#fff" };
const badge = { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999 };
const greyBadge = { ...badge, background: "rgba(136,146,180,0.12)", color: "#4a5278" };
const inputClass = "input-glass block w-full rounded-xl px-3 py-2 mt-1 text-sm";
const serif = "Georgia, 'Times New Roman', serif";
const MAX_BULLETS = 8;

const clip = (value, max) => [...value].slice(0, max).join("");
const toLines = (value) => value.split("\n");
const toList = (value) => value.split(/,\s*/);

function Field({ id, label, value, onChange, maxLength, placeholder, textarea, rows = 3 }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs" style={{ color: "var(--text-3)" }}>{label}</label>
      {textarea
        ? <textarea id={id} className={inputClass} rows={rows} value={value} maxLength={maxLength} placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)} style={{ lineHeight: 1.5 }} />
        : <input id={id} className={inputClass} value={value} maxLength={maxLength} placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)} />}
    </div>
  );
}

function EnhancePanel({ id, notes, onNotes, tone, onTone, suggestion, busy, onEnhance, onAccept, onEdit, onEditText, onDismiss, notesLabel = "Your notes" }) {
  return (
    <div className="mt-3">
      <Field id={`${id}-notes`} label={notesLabel} textarea value={notes} onChange={onNotes} maxLength={1500}
        placeholder="Write what you did in plain words. AI will only rephrase it." />
      <div className="flex flex-wrap items-center gap-2.5 mt-3">
        <button type="button" className="btn-primary px-4 py-2 rounded-xl text-sm disabled:opacity-50"
          disabled={busy || !notes.trim()} onClick={onEnhance}>{busy ? "Enhancing…" : "✨ Enhance with AI"}</button>
        <label htmlFor={`${id}-tone`} className="sr-only">Tone</label>
        <select id={`${id}-tone`} className="btn-ghost rounded-xl px-3 py-2 text-sm" value={tone} onChange={(event) => onTone(event.target.value)}>
          <option value="professional">Tone: Professional</option>
          <option value="concise">Tone: Concise</option>
        </select>
      </div>
      {suggestion && (
        <div className="mt-4 rounded-2xl p-3.5" aria-label="AI suggestion" role="region"
          style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <div style={{ ...labelStyle, color: "#059669" }}>AI suggestion</div>
          {suggestion.editing ? (
            <>
              <label htmlFor={`${id}-edit`} className="sr-only">Edit suggestion</label>
              <textarea id={`${id}-edit`} className={inputClass} rows={5} value={suggestion.text}
                onChange={(event) => onEditText(event.target.value)} />
            </>
          ) : (
            <ul className="mt-2 ml-4 list-disc" style={{ fontSize: "12.5px", lineHeight: 1.55, color: "var(--text)" }}>
              {suggestion.bullets.map((bullet) => <li key={bullet} className="mb-1">{bullet}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 mt-2.5">
            <button type="button" style={{ ...badge, background: "rgba(16,185,129,0.12)", color: "#059669" }} onClick={onAccept}>✓ Accept</button>
            {!suggestion.editing && <button type="button" style={greyBadge} onClick={onEdit}>Edit</button>}
            <button type="button" style={greyBadge} disabled={busy} onClick={onEnhance}>{busy ? "Regenerating…" : "Regenerate"}</button>
            <button type="button" style={greyBadge} onClick={onDismiss}>Discard</button>
          </div>
          <p className="mt-2" style={{ fontSize: 11, color: "var(--text-3)" }}>
            AI only rephrases what you wrote — it never adds experience you don't have. Check every bullet before you accept it.
          </p>
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score }) {
  const value = score ?? 0;
  const color = value >= 75 ? "#10b981" : value >= 50 ? "#f59e0b" : "#f43f7e";
  return (
    <div role="img" aria-label={score == null ? "ATS score not available yet" : `ATS score ${score} out of 100`}
      style={{ width: 74, height: 74, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: `conic-gradient(${color} 0 ${value}%, rgba(16,185,129,0.12) ${value}% 100%)`, transition: "background 0.6s" }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#f4f6fb", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center" }}>
        <b style={{ fontSize: 20, color }}>{score ?? "–"}</b>
        <span style={{ fontSize: 9, color: "var(--text-3)" }}>/100</span>
      </div>
    </div>
  );
}

function Preview({ draft, highlighted }) {
  const s = cleanDraft(draft).sections;
  const heading = (text) => (
    <h3 style={{ fontSize: "11.5px", fontWeight: 700, borderBottom: "1px solid #333", marginTop: 12, paddingBottom: 2, letterSpacing: "0.04em" }}>{text}</h3>
  );
  const bulletList = (items) => (
    <ul style={{ fontSize: "10.5px", margin: "2px 0 0 16px", lineHeight: 1.45, listStyle: "disc" }}>
      {items.map((item, index) => (
        <li key={`${index}-${item}`} data-highlighted={highlighted.has(item) || undefined}
          style={{ background: highlighted.has(item) ? "rgba(16,185,129,0.15)" : "transparent", transition: "background 0.8s", borderRadius: 3 }}>{item}</li>
      ))}
    </ul>
  );
  const contact = [s.contact.email, s.contact.phone, ...s.contact.links].filter(Boolean);
  const empty = !draftToText(draft);
  return (
    <section aria-label="Resume preview" className="glass rounded-2xl" style={{ background: "#fff", padding: "26px 30px", fontFamily: serif, color: "#111" }}>
      {empty && <p style={{ fontSize: 12, color: "#666", fontFamily: font }}>Your resume preview appears here as you fill in sections.</p>}
      {s.contact.name && <h2 style={{ textAlign: "center", fontSize: 20, fontWeight: 700 }}>{s.contact.name.toUpperCase()}</h2>}
      {contact.length > 0 && <p style={{ textAlign: "center", fontSize: "10.5px", color: "#444", marginTop: 2 }}>{contact.join(" · ")}</p>}
      {s.summary && <>{heading("SUMMARY")}
        <p style={{ fontSize: "10.5px", marginTop: 4, lineHeight: 1.45, background: highlighted.has(s.summary) ? "rgba(16,185,129,0.15)" : "transparent", transition: "background 0.8s" }}>{s.summary}</p></>}
      {s.skills.length > 0 && <>{heading("SKILLS")}
        {s.skills.map((group, index) => (
          <p key={index} style={{ fontSize: "10.5px", marginTop: 4, lineHeight: 1.45 }}>{group.group && <b>{group.group}: </b>}{group.items.join(", ")}</p>
        ))}</>}
      {s.experience.length > 0 && <>{heading("EXPERIENCE")}
        {s.experience.map((item, index) => (
          <div key={index}>
            <p style={{ fontSize: "10.5px", marginTop: 4, display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span><b>{item.role}</b>{item.role && item.org ? ", " : ""}{item.org}</span><span>{dateRange(item.start, item.end)}</span>
            </p>
            {bulletList(item.bullets)}
          </div>
        ))}</>}
      {s.projects.length > 0 && <>{heading("PROJECTS")}
        {s.projects.map((item, index) => (
          <div key={index}>
            <p style={{ fontSize: "10.5px", marginTop: 4 }}><b>{item.name}</b>{item.tech.length > 0 && ` · ${item.tech.join(", ")}`}</p>
            {bulletList(item.bullets)}
          </div>
        ))}</>}
      {s.education.length > 0 && <>{heading("EDUCATION")}
        {s.education.map((item, index) => (
          <p key={index} style={{ fontSize: "10.5px", marginTop: 4, display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span><b>{item.degree}</b>{item.degree && item.institute ? ", " : ""}{item.institute}{item.score && ` — ${item.score}`}</span>
            <span>{dateRange(item.start, item.end)}</span>
          </p>
        ))}</>}
      {s.certifications.length > 0 && <>{heading("CERTIFICATIONS")}{bulletList(s.certifications)}</>}
      {s.achievements.length > 0 && <>{heading("ACHIEVEMENTS")}{bulletList(s.achievements)}</>}
    </section>
  );
}

export default function ResumeBuilder({ onNavigate }) {
  const [exported, setExported] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [active, setActive] = useState("contact");
  const [notes, setNotes] = useState({});
  const [tones, setTones] = useState({});
  const [suggestions, setSuggestions] = useState({});
  const [enhancing, setEnhancing] = useState(null);
  const [highlighted, setHighlighted] = useState(() => new Set());
  const [score, setScore] = useState(null);
  const [previousScore, setPreviousScore] = useState(null);
  const [scoreError, setScoreError] = useState("");
  const [scoring, setScoring] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lastScored = useRef("");
  const scoreRef = useRef(null);
  const scoreRequest = useRef(0);
  const highlightTimer = useRef(null);

  const resetEditor = (next) => {
    setDraft(next);
    setNotes({});
    setSuggestions({});
    setMessage("");
  };

  useEffect(() => {
    let active = true;
    axios.get(`${API}/api/resume-builder/drafts`, auth())
      .then(async ({ data }) => {
        const list = Array.isArray(data) ? data : [];
        if (!active) return;
        setDrafts(list);
        if (list.length) {
          const { data: full } = await axios.get(`${API}/api/resume-builder/drafts/${list[0]._id}`, auth());
          if (active) setDraft(normalizeDraft(full));
        }
      })
      .catch((err) => { if (active) setError(errorMessage(err, "Could not load your drafts.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; clearTimeout(highlightTimer.current); };
  }, []);

  // Live ATS score: rescore ~800 ms after the resume text stops changing.
  const resumeText = useMemo(() => draftToText(draft), [draft]);
  useEffect(() => {
    if (loading || !resumeText || resumeText === lastScored.current) return undefined;
    const timer = setTimeout(async () => {
      lastScored.current = resumeText;
      const id = ++scoreRequest.current;
      setScoring(true);
      try {
        const { data } = await axios.post(`${API}/api/resume-builder/score`, { text: resumeText }, auth());
        if (id !== scoreRequest.current) return;
        setPreviousScore(scoreRef.current?.atsScore ?? null);
        scoreRef.current = data;
        setScore(data);
        setScoreError("");
      } catch (err) {
        if (id === scoreRequest.current) setScoreError(errorMessage(err, "Live score unavailable."));
      } finally {
        if (id === scoreRequest.current) setScoring(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [resumeText, loading]);

  const sections = draft.sections;
  const updateSections = (update) => setDraft((current) => ({ ...current, sections: update(current.sections) }));
  const setField = (key, value) => updateSections((current) => ({ ...current, [key]: value }));
  const setEntry = (key, index, patch) => updateSections((current) => ({
    ...current, [key]: current[key].map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
  }));
  const addEntry = (key, factory) => updateSections((current) => ({ ...current, [key]: [...current[key], factory()] }));
  const removeEntry = (key, index) => updateSections((current) => ({ ...current, [key]: current[key].filter((_, i) => i !== index) }));

  const enhance = async (id, section, title, text) => {
    setError("");
    setEnhancing(id);
    try {
      const { data } = await axios.post(`${API}/api/resume-builder/enhance`,
        { section, title: clip(title.trim(), 120), notes: text, tone: tones[id] || "professional" }, auth());
      setSuggestions((current) => ({ ...current, [id]: { bullets: data.bullets, editing: false, text: data.bullets.join("\n") } }));
    } catch (err) {
      setError(errorMessage(err, "AI suggestion unavailable. Try again."));
    } finally {
      setEnhancing(null);
    }
  };

  const accept = (id, apply) => {
    const suggestion = suggestions[id];
    const accepted = (suggestion.editing ? suggestion.text.split("\n") : suggestion.bullets)
      .map((line) => line.trim()).filter(Boolean);
    if (!accepted.length) return;
    const shown = apply(accepted);
    setSuggestions((current) => { const next = { ...current }; delete next[id]; return next; });
    setHighlighted(new Set(shown));
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlighted(new Set()), 2500);
  };

  const acceptIntoEntry = (key, index) => (accepted) => {
    const kept = sections[key][index].bullets.filter((bullet) => bullet.trim());
    const added = accepted.slice(0, Math.max(0, MAX_BULLETS - kept.length)).map((bullet) => clip(bullet, 300));
    setEntry(key, index, { bullets: [...kept, ...added] });
    return added;
  };

  const panelProps = (id, section, title, onAccept) => ({
    id,
    notes: notes[id] || "",
    onNotes: (value) => setNotes((current) => ({ ...current, [id]: value })),
    tone: tones[id] || "professional",
    onTone: (value) => setTones((current) => ({ ...current, [id]: value })),
    suggestion: suggestions[id],
    busy: enhancing === id,
    onEnhance: () => enhance(id, section, title, notes[id] || ""),
    onAccept: () => accept(id, onAccept),
    onEdit: () => setSuggestions((current) => ({ ...current, [id]: { ...current[id], editing: true } })),
    onEditText: (text) => setSuggestions((current) => ({ ...current, [id]: { ...current[id], text } })),
    onDismiss: () => setSuggestions((current) => { const next = { ...current }; delete next[id]; return next; }),
  });

  const importAnalysis = async () => {
    setError("");
    setMessage("");
    try {
      const { data: history } = await axios.get(`${API}/api/history`, auth());
      if (!Array.isArray(history) || !history.length) {
        setError("Upload a resume on the Analyze page first.");
        return;
      }
      const { data } = await axios.post(`${API}/api/resume-builder/import`, { analysisId: history[0]._id }, auth());
      const keepSummary = sections.summary.trim() !== "";
      updateSections((current) => ({
        ...current,
        skills: data.sections.skills.length ? data.sections.skills : current.skills,
        summary: keepSummary ? current.summary : data.sections.summary,
      }));
      setMessage(`Imported skills${!keepSummary && data.sections.summary ? " and summary" : ""} from ${data.resumeName}.` +
        (keepSummary ? " Your existing summary was kept." : ""));
    } catch (err) {
      setError(errorMessage(err, "Could not import your analysis."));
    }
  };

  const save = async () => {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const body = { ...cleanDraft(draft), atsScore: score?.atsScore ?? draft.atsScore ?? null };
      const { data } = draft._id
        ? await axios.put(`${API}/api/resume-builder/drafts/${draft._id}`, body, auth())
        : await axios.post(`${API}/api/resume-builder/drafts`, body, auth());
      setDraft((current) => ({ ...current, _id: data._id, atsScore: data.atsScore }));
      setDrafts((list) => [{ _id: data._id, title: data.title, atsScore: data.atsScore, updatedAt: data.updatedAt },
        ...list.filter((item) => item._id !== data._id)]);
      setMessage("Draft saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save draft."));
    } finally {
      setSaving(false);
    }
  };

  const openDraft = async (id) => {
    setError("");
    if (id === "new") { resetEditor(emptyDraft()); return; }
    try {
      const { data } = await axios.get(`${API}/api/resume-builder/drafts/${id}`, auth());
      resetEditor(normalizeDraft(data));
    } catch (err) {
      setError(errorMessage(err, "Could not open draft."));
    }
  };

  // An exported PDF only matches the draft until the next edit.
  useEffect(() => { setExported(null); }, [draft]);

  const exportPdf = async () => {
    setError("");
    try {
      setExported((await exportResumePdf(draft)) || null);
    } catch {
      setError("Could not create the PDF. Try again.");
    }
  };

  const renderSection = () => {
    switch (active) {
      case "contact":
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="contact-name" label="Full name" value={sections.contact.name} maxLength={100}
              onChange={(value) => setField("contact", { ...sections.contact, name: value })} />
            <Field id="contact-email" label="Email" value={sections.contact.email} maxLength={254}
              onChange={(value) => setField("contact", { ...sections.contact, email: value })} />
            <Field id="contact-phone" label="Phone" value={sections.contact.phone} maxLength={40}
              onChange={(value) => setField("contact", { ...sections.contact, phone: value })} />
            <Field id="contact-links" label="Links (comma separated, up to 5)" value={sections.contact.links.join(", ")}
              onChange={(value) => setField("contact", { ...sections.contact, links: toList(value).slice(0, 5) })} />
          </div>
        );
      case "summary":
        return (
          <>
            <Field id="summary-text" label="Summary" textarea rows={4} value={sections.summary} maxLength={1500}
              onChange={(value) => setField("summary", value)} />
            <EnhancePanel notesLabel="Your notes for the summary" {...panelProps("summary", "summary", "Professional summary", (accepted) => {
              const text = clip(accepted.join(" "), 1500);
              setField("summary", text);
              return [text];
            })} />
          </>
        );
      case "skills":
        return (
          <div className="space-y-3">
            {sections.skills.map((group, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-end">
                <Field id={`skills-${index}-group`} label="Group" value={group.group} maxLength={60} placeholder="Languages"
                  onChange={(value) => setEntry("skills", index, { group: value })} />
                <Field id={`skills-${index}-items`} label="Skills (comma separated)" value={group.items.join(", ")}
                  onChange={(value) => setEntry("skills", index, { items: toList(value).slice(0, 30) })} />
                <button type="button" className="text-xs text-red-600 pb-2" onClick={() => removeEntry("skills", index)}>Remove</button>
              </div>
            ))}
            {sections.skills.length < 10 && <button type="button" className="btn-ghost rounded-xl px-3 py-1.5 text-xs" onClick={() => addEntry("skills", emptySkillGroup)}>+ Add skill group</button>}
          </div>
        );
      case "experience":
      case "projects": {
        const isProject = active === "projects";
        const list = sections[active];
        return (
          <div className="space-y-5">
            {list.map((entry, index) => {
              const id = `${active}-${index}`;
              const title = isProject ? entry.name : [entry.role, entry.org].filter(Boolean).join(" at ");
              return (
                <div key={index} className="space-y-3" style={{ borderTop: index ? "1px solid rgba(180,190,220,0.4)" : "none", paddingTop: index ? 16 : 0 }}>
                  <div className="flex justify-between items-center">
                    <div style={labelStyle}>{isProject ? "Project" : "Experience"} · {title || "New entry"}</div>
                    <button type="button" className="text-xs text-red-600" onClick={() => removeEntry(active, index)}>Remove</button>
                  </div>
                  {isProject ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field id={`${id}-name`} label="Project name" value={entry.name} maxLength={150} onChange={(value) => setEntry(active, index, { name: value })} />
                      <Field id={`${id}-tech`} label="Tech (comma separated)" value={entry.tech.join(", ")} onChange={(value) => setEntry(active, index, { tech: toList(value).slice(0, 15) })} />
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field id={`${id}-role`} label="Role" value={entry.role} maxLength={150} onChange={(value) => setEntry(active, index, { role: value })} />
                      <Field id={`${id}-org`} label="Organisation" value={entry.org} maxLength={150} onChange={(value) => setEntry(active, index, { org: value })} />
                      <Field id={`${id}-start`} label="Start" value={entry.start} maxLength={30} placeholder="May 2026" onChange={(value) => setEntry(active, index, { start: value })} />
                      <Field id={`${id}-end`} label="End" value={entry.end} maxLength={30} placeholder="Present" onChange={(value) => setEntry(active, index, { end: value })} />
                    </div>
                  )}
                  <Field id={`${id}-bullets`} label={`Bullets (one per line, up to ${MAX_BULLETS})`} textarea rows={3} value={entry.bullets.join("\n")}
                    onChange={(value) => setEntry(active, index, { bullets: toLines(value).slice(0, MAX_BULLETS) })} />
                  <EnhancePanel {...panelProps(id, isProject ? "project" : "experience", title, acceptIntoEntry(active, index))} />
                </div>
              );
            })}
            {list.length < 10 && (
              <button type="button" className="btn-ghost rounded-xl px-3 py-1.5 text-xs"
                onClick={() => addEntry(active, isProject ? emptyProject : emptyExperience)}>+ Add {isProject ? "project" : "experience"}</button>
            )}
          </div>
        );
      }
      case "education":
        return (
          <div className="space-y-4">
            {sections.education.map((entry, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-2">
                <Field id={`education-${index}-degree`} label="Degree" value={entry.degree} maxLength={150} onChange={(value) => setEntry("education", index, { degree: value })} />
                <Field id={`education-${index}-institute`} label="Institute" value={entry.institute} maxLength={150} onChange={(value) => setEntry("education", index, { institute: value })} />
                <Field id={`education-${index}-start`} label="Start" value={entry.start} maxLength={30} onChange={(value) => setEntry("education", index, { start: value })} />
                <Field id={`education-${index}-end`} label="End" value={entry.end} maxLength={30} onChange={(value) => setEntry("education", index, { end: value })} />
                <Field id={`education-${index}-score`} label="Score (CGPA / %)" value={entry.score} maxLength={30} onChange={(value) => setEntry("education", index, { score: value })} />
                <button type="button" className="text-xs text-red-600 justify-self-start self-end pb-2" onClick={() => removeEntry("education", index)}>Remove</button>
              </div>
            ))}
            {sections.education.length < 6 && <button type="button" className="btn-ghost rounded-xl px-3 py-1.5 text-xs" onClick={() => addEntry("education", emptyEducation)}>+ Add education</button>}
          </div>
        );
      default:
        return (
          <Field id={`${active}-list`} label={`${SECTION_TABS.find((tab) => tab.key === active).label} (one per line, up to 20)`} textarea rows={5}
            value={sections[active].join("\n")} onChange={(value) => setField(active, toLines(value).slice(0, 20))} />
        );
    }
  };

  const breakdown = Object.values(score?.atsBreakdown || {});
  const delta = score && previousScore != null ? score.atsScore - previousScore : 0;

  return (
    <main className="px-6 py-10 max-w-6xl mx-auto" style={{ color: "var(--text)", fontFamily: font }}>
      <h1 className="text-2xl font-extrabold">
        AI Resume <em className="gradient-text" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}>Builder</em>
      </h1>
      <p className="text-sm mt-1.5 mb-6" style={{ color: "var(--text-2)" }}>
        Build an ATS-friendly resume. Write rough notes and let AI turn them into impact-focused bullet points.
      </p>
      {error && <p role="alert" className="text-red-600 text-sm mb-4">{error}</p>}
      {message && <p role="status" className="text-sm mb-4" style={{ color: "#059669" }}>{message}</p>}

      {loading ? <p role="status" className="text-sm">Loading your drafts…</p> : (
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <div className="space-y-4 min-w-0">
            <div className="glass rounded-2xl p-5">
              <div className="grid gap-3 sm:grid-cols-2 mb-4">
                <div>
                  <label htmlFor="draft-select" style={labelStyle}>Draft</label>
                  <select id="draft-select" className={inputClass} value={draft._id || "new"} onChange={(event) => openDraft(event.target.value)}>
                    {!draft._id && <option value="new">New draft (unsaved)</option>}
                    {drafts.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}
                    {draft._id && <option value="new">+ New draft</option>}
                  </select>
                </div>
                <Field id="draft-title" label="Draft title" value={draft.title} maxLength={120}
                  onChange={(value) => setDraft((current) => ({ ...current, title: value }))} />
              </div>
              <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
                <div style={labelStyle}>Sections</div>
                <button type="button" className="btn-ghost rounded-xl text-xs" style={{ padding: "5px 10px" }} onClick={importAnalysis}>
                  ⟳ Import from latest analysis
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Resume sections">
                {SECTION_TABS.map((tab) => {
                  const complete = isSectionComplete(sections, tab.key);
                  const selected = active === tab.key;
                  return (
                    <button key={tab.key} type="button" className="skill-pill" aria-pressed={selected}
                      style={selected ? activePill : complete ? okPill : { display: "inline-block" }} onClick={() => setActive(tab.key)}>
                      {tab.label}{selected ? " ✎" : complete ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="glass rounded-2xl p-5">{renderSection()}</div>
          </div>

          <div className="space-y-4 min-w-0">
            <div className="glass rounded-2xl flex items-center gap-4" style={{ padding: "18px 22px" }} aria-live="polite">
              <ScoreRing score={score?.atsScore ?? null} />
              <div className="min-w-0">
                <div className="font-bold">Live ATS score</div>
                <div style={{ fontSize: "12.5px", color: "var(--text-2)" }}>
                  {scoring ? "Scoring…" : scoreError || (!score ? "Add content to see your score." :
                    delta ? `${delta > 0 ? "+" : ""}${delta} since your last change` : "Updates as you edit")}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {breakdown.map((item) => (
                    <span key={item.label} className="skill-pill" style={item.score / item.max >= 0.7 ? okPill : missPill}>
                      {item.label} {item.score}/{item.max}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Preview draft={draft} highlighted={highlighted} />
            <div className="flex flex-wrap gap-2.5 justify-end items-center">
              <label htmlFor="template-select" className="sr-only">Template</label>
              <select id="template-select" className="btn-ghost rounded-xl px-3 py-2 text-sm" value="classic" onChange={() => {}}>
                <option value="classic">Template: Classic ATS</option>
              </select>
              <button type="button" className="btn-ghost rounded-xl px-4 py-2 text-sm disabled:opacity-50" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "💾 Save draft"}
              </button>
              <button type="button" className="btn-primary rounded-xl px-5 py-2.5 text-sm disabled:opacity-50" disabled={!resumeText} onClick={exportPdf}>
                ⬇ Export PDF
              </button>
            </div>
            {exported && onNavigate && (
              <div className="glass rounded-2xl flex flex-wrap items-center justify-between gap-3" style={{ padding: "14px 18px" }} aria-live="polite">
                <span style={{ fontSize: "12.5px", color: "var(--text-2)" }}>
                  Downloaded <strong>{exported.name}</strong>. Run the full analysis on it to unlock JD matching, a roadmap and interview practice.
                </span>
                <button type="button" className="btn-primary rounded-xl px-4 py-2 text-sm" onClick={() => onNavigate("analyze", { file: exported })}>
                  Analyze this resume →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
