import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowRight, Check, Download, Import, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Icon, InlineAlert, Input, LoadingState, PageHeader, ScoreRing, Select, Textarea, cx } from "../components/ui";
import {
  SECTION_TABS, cleanDraft, dateRange, draftToText, emptyDraft, emptyEducation, emptyExperience, emptyProject,
  emptySkillGroup, isSectionComplete, normalizeDraft,
} from "../utils/resumeDraft";
import { exportResumePdf } from "../utils/resumePdf";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const errorMessage = (error, fallback) => error.response?.data?.error || error.response?.data?.message || fallback;

const MAX_BULLETS = 8;
const TONES = [{ value: "professional", label: "Professional" }, { value: "concise", label: "Concise" }];

const clip = (value, max) => [...value].slice(0, max).join("");
const toLines = (value) => value.split("\n");
const toList = (value) => value.split(/,\s*/);

// Text field bound to a plain string; `textarea` switches to the multi-line control.
function Field({ id, label, value, onChange, maxLength, placeholder, textarea, rows = 3, hint }) {
  const props = { id, label, value, placeholder, hint, onChange: (event) => onChange(event.target.value) };
  return textarea
    ? <Textarea {...props} rows={rows} maxLength={maxLength} />
    : <Input {...props} maxLength={maxLength} />;
}

function EnhancePanel({ id, notes, onNotes, tone, onTone, suggestion, busy, onEnhance, onAccept, onEdit, onEditText, onDismiss, notesLabel = "Your notes" }) {
  return (
    <div className="mt-4 rounded-card border border-line bg-page p-4">
      <Field id={`${id}-notes`} label={notesLabel} textarea value={notes} onChange={onNotes} maxLength={1500}
        placeholder="Write what you did in plain words. AI will only rephrase it." />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Select id={`${id}-tone`} label="Tone" value={tone} onChange={(event) => onTone(event.target.value)} options={TONES} className="w-40" />
        <Button icon={Sparkles} loading={busy && !suggestion} disabled={busy || !notes.trim()} onClick={onEnhance}>
          {busy && !suggestion ? "Improving…" : "Improve with AI"}
        </Button>
      </div>
      {suggestion && (
        <div className="mt-4 rounded-card border border-line bg-surface" aria-label="AI suggestion" role="region">
          {/* Before → after, so the change is easy to judge. */}
          <div className="grid gap-px overflow-hidden rounded-t-card bg-line md:grid-cols-2">
            <div className="bg-surface p-3">
              <p className="text-xs font-medium text-ink-muted">Your notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-secondary">{notes}</p>
            </div>
            <div className="bg-surface p-3">
              <p className="flex items-center gap-1 text-xs font-medium text-brand"><Icon icon={ArrowRight} size={12} />Suggestion</p>
              {suggestion.editing ? (
                <Textarea id={`${id}-edit`} label="Edit suggestion" hideLabel rows={5} className="mt-1" value={suggestion.text}
                  onChange={(event) => onEditText(event.target.value)} />
              ) : (
                <ul className="mt-1 space-y-1.5">
                  {suggestion.bullets.map((bullet) => <li key={bullet} className="border-l-2 border-brand pl-2 text-sm text-ink">{bullet}</li>)}
                </ul>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
            <Button size="sm" variant="primary" icon={Check} onClick={onAccept}>Accept</Button>
            {!suggestion.editing && <Button size="sm" icon={Pencil} onClick={onEdit}>Edit</Button>}
            <Button size="sm" icon={RefreshCw} loading={busy} onClick={onEnhance}>{busy ? "Regenerating…" : "Regenerate"}</Button>
            <Button size="sm" variant="ghost" icon={X} onClick={onDismiss}>Discard</Button>
          </div>
          <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">
            AI only rephrases what you wrote. It never adds experience you don't have. Check every bullet before you accept it.
          </p>
        </div>
      )}
    </div>
  );
}

// The resume itself (not app UI) keeps the serif document font, matching the exported PDF.
function Preview({ draft, highlighted }) {
  const s = cleanDraft(draft).sections;
  const mark = (item) => (highlighted.has(item) ? "bg-brand-tint" : "");
  const heading = (text) => <h3 className="mt-3 border-b border-[#333] pb-0.5 text-xs font-semibold tracking-[0.04em]">{text}</h3>;
  const bulletList = (items) => (
    <ul className="ml-4 mt-0.5 list-disc text-xs leading-5">
      {items.map((item, index) => (
        <li key={`${index}-${item}`} data-highlighted={highlighted.has(item) || undefined} className={cx("rounded-sm transition-ui", mark(item))}>{item}</li>
      ))}
    </ul>
  );
  const contact = [s.contact.email, s.contact.phone, ...s.contact.links].filter(Boolean);
  const empty = !draftToText(draft);
  return (
    <section aria-label="Resume preview" style={{ fontFamily: "var(--font-serif-document)" }}
      className="aspect-[210/297] w-full overflow-y-auto rounded-card border border-line bg-white p-6 text-[#111] shadow-card">
      {empty && <p className="font-sans text-sm text-ink-muted">Your resume preview appears here as you fill in sections.</p>}
      {s.contact.name && <h2 className="text-center text-lg font-semibold">{s.contact.name.toUpperCase()}</h2>}
      {contact.length > 0 && <p className="mt-0.5 text-center text-xs text-[#444]">{contact.join(" · ")}</p>}
      {s.summary && <>{heading("SUMMARY")}<p className={cx("mt-1 text-xs leading-5 transition-ui", mark(s.summary))}>{s.summary}</p></>}
      {s.skills.length > 0 && <>{heading("SKILLS")}
        {s.skills.map((group, index) => (
          <p key={index} className="mt-1 text-xs leading-5">{group.group && <b>{group.group}: </b>}{group.items.join(", ")}</p>
        ))}</>}
      {s.experience.length > 0 && <>{heading("EXPERIENCE")}
        {s.experience.map((item, index) => (
          <div key={index}>
            <p className="mt-1 flex justify-between gap-2 text-xs">
              <span><b>{item.role}</b>{item.role && item.org ? ", " : ""}{item.org}</span><span>{dateRange(item.start, item.end)}</span>
            </p>
            {bulletList(item.bullets)}
          </div>
        ))}</>}
      {s.projects.length > 0 && <>{heading("PROJECTS")}
        {s.projects.map((item, index) => (
          <div key={index}>
            <p className="mt-1 text-xs"><b>{item.name}</b>{item.tech.length > 0 && ` · ${item.tech.join(", ")}`}</p>
            {bulletList(item.bullets)}
          </div>
        ))}</>}
      {s.education.length > 0 && <>{heading("EDUCATION")}
        {s.education.map((item, index) => (
          <p key={index} className="mt-1 flex justify-between gap-2 text-xs">
            <span><b>{item.degree}</b>{item.degree && item.institute ? ", " : ""}{item.institute}{item.score && ` · ${item.score}`}</span>
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
          <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="space-y-4">
            {sections.skills.map((group, index) => (
              <div key={index} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
                <Field id={`skills-${index}-group`} label="Group" value={group.group} maxLength={60} placeholder="Languages"
                  onChange={(value) => setEntry("skills", index, { group: value })} />
                <Field id={`skills-${index}-items`} label="Skills (comma separated)" value={group.items.join(", ")}
                  onChange={(value) => setEntry("skills", index, { items: toList(value).slice(0, 30) })} />
                <Button variant="ghost" icon={Trash2} aria-label={`Remove skill group ${index + 1}`} onClick={() => removeEntry("skills", index)} />
              </div>
            ))}
            {sections.skills.length < 10 && <Button size="sm" icon={Plus} onClick={() => addEntry("skills", emptySkillGroup)}>Add skill group</Button>}
          </div>
        );
      case "experience":
      case "projects": {
        const isProject = active === "projects";
        const list = sections[active];
        return (
          <div className="space-y-6">
            {list.map((entry, index) => {
              const id = `${active}-${index}`;
              const title = isProject ? entry.name : [entry.role, entry.org].filter(Boolean).join(" at ");
              return (
                <div key={index} className={cx("space-y-4", index > 0 && "border-t border-line pt-5")}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-sm font-semibold text-ink">{title || (isProject ? "New project" : "New experience")}</h3>
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => removeEntry(active, index)}>Remove</Button>
                  </div>
                  {isProject ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field id={`${id}-name`} label="Project name" value={entry.name} maxLength={150} onChange={(value) => setEntry(active, index, { name: value })} />
                      <Field id={`${id}-tech`} label="Tech (comma separated)" value={entry.tech.join(", ")} onChange={(value) => setEntry(active, index, { tech: toList(value).slice(0, 15) })} />
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
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
              <Button size="sm" icon={Plus} onClick={() => addEntry(active, isProject ? emptyProject : emptyExperience)}>
                Add {isProject ? "project" : "experience"}
              </Button>
            )}
          </div>
        );
      }
      case "education":
        return (
          <div className="space-y-6">
            {sections.education.map((entry, index) => (
              <div key={index} className={cx("grid gap-4 sm:grid-cols-2", index > 0 && "border-t border-line pt-5")}>
                <Field id={`education-${index}-degree`} label="Degree" value={entry.degree} maxLength={150} onChange={(value) => setEntry("education", index, { degree: value })} />
                <Field id={`education-${index}-institute`} label="Institute" value={entry.institute} maxLength={150} onChange={(value) => setEntry("education", index, { institute: value })} />
                <Field id={`education-${index}-start`} label="Start" value={entry.start} maxLength={30} onChange={(value) => setEntry("education", index, { start: value })} />
                <Field id={`education-${index}-end`} label="End" value={entry.end} maxLength={30} onChange={(value) => setEntry("education", index, { end: value })} />
                <Field id={`education-${index}-score`} label="Score (CGPA / %)" value={entry.score} maxLength={30} onChange={(value) => setEntry("education", index, { score: value })} />
                <Button size="sm" variant="ghost" icon={Trash2} className="self-end justify-self-start" onClick={() => removeEntry("education", index)}>Remove</Button>
              </div>
            ))}
            {sections.education.length < 6 && <Button size="sm" icon={Plus} onClick={() => addEntry("education", emptyEducation)}>Add education</Button>}
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
  const activeLabel = SECTION_TABS.find((tab) => tab.key === active)?.label;

  return (
    <>
      <PageHeader
        title="Resume builder"
        description="Write rough notes, let AI turn them into ATS-friendly bullets, and watch your score as you edit."
        actions={!loading && <>
          <Button icon={Save} loading={saving} onClick={save}>{saving ? "Saving…" : "Save draft"}</Button>
          <Button variant="primary" icon={Download} disabled={!resumeText} onClick={exportPdf}>Export PDF</Button>
        </>}
      />
      {error && <InlineAlert className="mb-4" onDismiss={() => setError("")}>{error}</InlineAlert>}
      {message && <InlineAlert tone="success" className="mb-4" onDismiss={() => setMessage("")}>{message}</InlineAlert>}
      {exported && onNavigate && (
        <InlineAlert tone="info" className="mb-4"
          action={<Button size="sm" variant="primary" iconRight={ArrowRight} onClick={() => onNavigate("analyze", { file: exported })}>Analyze this resume</Button>}>
          Downloaded <span className="font-medium text-ink">{exported.name}</span>. Analyze it to unlock JD matching, a roadmap and interview practice.
        </InlineAlert>
      )}

      {loading ? <LoadingState label="Loading your drafts" /> : (
        <>
          <Card className="mb-6">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <Select id="draft-select" label="Draft" value={draft._id || "new"} onChange={(event) => openDraft(event.target.value)}
                options={[
                  ...(!draft._id ? [{ value: "new", label: "New draft (unsaved)" }] : []),
                  ...drafts.map((item) => ({ value: item._id, label: item.title })),
                  ...(draft._id ? [{ value: "new", label: "Start a new draft" }] : []),
                ]} />
              <Field id="draft-title" label="Draft title" value={draft.title} maxLength={120}
                onChange={(value) => setDraft((current) => ({ ...current, title: value }))} />
              <Button icon={Import} onClick={importAnalysis}>Import from latest analysis</Button>
            </div>
            <p className="mt-3 text-sm text-ink-muted">Template: Classic ATS (single column, standard headings).</p>
          </Card>

          <div className="grid items-start gap-6 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[184px_minmax(0,1.15fr)_minmax(0,1fr)]">
            <nav aria-label="Resume sections" className="min-w-0">
              {/* relative: keeps the sr-only "(complete)" labels inside the scrolling stepper. */}
              <ol className="relative flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
                {SECTION_TABS.map((tab, index) => {
                  const complete = isSectionComplete(sections, tab.key);
                  const selected = active === tab.key;
                  return (
                    <li key={tab.key} className="shrink-0">
                      <button type="button" onClick={() => setActive(tab.key)} aria-current={selected ? "step" : undefined}
                        className={cx("flex w-full items-center gap-2.5 rounded-control border px-3 py-2 text-left text-sm transition-ui",
                          selected ? "border-brand bg-brand-tint font-medium text-ink" : "border-transparent text-ink-secondary hover:bg-hover")}>
                        <span aria-hidden="true" className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs",
                          complete ? "bg-success text-white" : selected ? "bg-brand text-white" : "border border-line-strong text-ink-muted")}>
                          {complete ? <Icon icon={Check} size={12} /> : <span className="tabular">{index + 1}</span>}
                        </span>
                        {tab.label}
                        {complete && <span className="sr-only"> (complete)</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <Card as="section" title={activeLabel} className="min-w-0">{renderSection()}</Card>

            {/* Stable preview: fixed A4 proportions, sticky beside the editor on wide screens. */}
            <div className="min-w-0 space-y-4 lg:col-start-2 xl:sticky xl:top-20 xl:col-start-3 xl:row-start-1">
              <Card padding="sm" aria-live="polite" className="flex items-center gap-4">
                <ScoreRing value={score?.atsScore ?? null} label="ATS score" size={64} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">Live ATS score</p>
                  <p className="text-sm text-ink-muted">
                    {scoring ? "Scoring…" : scoreError || (!score ? "Add content to see your score." :
                      delta ? `${delta > 0 ? "+" : ""}${delta} since your last change` : "Updates as you edit")}
                  </p>
                  {breakdown.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {breakdown.map((item) => (
                        <Badge key={item.label} tone={item.score / item.max >= 0.7 ? "success" : item.score / item.max < 0.5 ? "warning" : "neutral"}>
                          {item.label} <span className="tabular">{item.score}/{item.max}</span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
              <Preview draft={draft} highlighted={highlighted} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
