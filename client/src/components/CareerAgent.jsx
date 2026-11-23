import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Send, X } from "lucide-react";
import { Badge, Button, InlineAlert, cx } from "./ui";
import { roleLabel } from "../constants/targetRoles";
import { formatSkill } from "../utils/format";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Escape first, then apply a little markdown (bold, italics, numbered lists, line breaks).
// Model output is never inserted as raw HTML.
const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function renderMarkdown(text) {
  if (!text) return "";
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^(\d+)\.\s/gm, "<span class='font-medium text-brand'>$1.</span> ")
    .replace(/\n/g, "<br/>");
}

const SUGGESTIONS = [
  "What is my biggest skill gap?",
  "What should I learn first?",
  "How do I improve my ATS score?",
  "Which roles suit my profile?",
];

function Message({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={cx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cx("max-w-[85%] rounded-card px-3 py-2 text-sm leading-5",
          isUser ? "bg-brand text-white" : "border border-line bg-page text-ink")}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    </div>
  );
}

// Career coach side panel. The toggle lives in the top bar; `open` shows it, `onClose` hides it.
// The conversation is kept while the panel is closed.
export default function CareerAgent({ open = true, onClose, skills, atsScore, atsBreakdown, bestRole, matchData, targetRole, mlInsights }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Roadmap and interview progress from the dashboard summary; null until loaded (or if it fails).
  const [progress, setProgress] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => axios.get(`${API}/api/dashboard/summary`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }))
      .then(({ data }) => {
        if (!active) return;
        const next = data?.roadmap?.nextMilestone;
        setProgress({
          roadmap: data?.roadmap ? {
            targetRole: data.roadmap.targetRole, completion: data.roadmap.completion,
            nextMilestone: next ? { week: next.week, skill: next.skill, objective: next.objective } : null,
          } : null,
          lastInterviewScore: data?.interview?.lastScore ?? null,
          interviewReadiness: data?.interview?.readiness ?? null,
        });
      })
      .catch(() => {}); // The coach still works with resume context only.
    return () => { active = false; };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView?.({ block: "end" }); }, [messages, loading]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const hasAnalysis = Boolean(skills?.length || atsScore != null);
  const welcome = hasAnalysis
    ? `I can see your latest analysis: **${skills?.length || 0} skills**, ATS score **${atsScore ?? "–"}/100**, best match **${roleLabel(bestRole?.role) || "not available"}**.\nAsk about skill gaps, what to learn next or how to improve your resume.`
    : "Ask about skill gaps, what to learn next or how to improve your resume.";

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    if ([...content].length > 2000) {
      setError("Messages can be at most 2000 characters.");
      return;
    }
    setInput("");
    setError("");
    const conversation = [...messages, { role: "user", content }];
    setMessages(conversation);
    setLoading(true);

    // Resume context goes with every turn (including after clearing), split into validated user messages.
    const context = [...JSON.stringify({ skills, atsScore, atsBreakdown, bestRole, matchData, targetRole, mlInsights, careerProgress: progress })];
    const history = [];
    for (let i = 0; i < context.length; i += 1800) {
      history.push({ role: "user", content: `Resume analysis context (part ${Math.floor(i / 1800) + 1}):\n${context.slice(i, i + 1800).join("")}` });
    }
    history.push(...conversation.slice(0, -1).map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content })));

    try {
      const res = await axios.post(`${API}/api/agent/chat`, { message: content, history },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, timeout: 35000 });
      setMessages((previous) => [...previous, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      setError(err.response?.data?.error || (err.code === "ECONNABORTED" ? "The coach took too long to reply. Try again." : "The coach is unavailable. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); }
  };
  const next = progress?.roadmap?.nextMilestone;

  // `hidden` alone is not enough: the `flex` utility would override it, so the display class follows `open`.
  return (
    <aside
      id="career-coach" aria-label="Career coach" hidden={!open}
      onKeyDown={(event) => { if (event.key === "Escape" && onClose) onClose(); }}
      className={cx("fixed inset-y-0 right-0 z-50 w-full flex-col border-l border-line bg-surface shadow-overlay md:w-[380px] 2xl:shadow-none",
        open ? "flex" : "hidden")}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">Career coach</h2>
          <p className="truncate text-xs text-ink-muted">{hasAnalysis ? "Uses your latest analysis" : "No analysis yet"}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setMessages([]); setError(""); }} disabled={!messages.length || loading}>Clear</Button>
          {onClose && <Button variant="ghost" size="sm" icon={X} aria-label="Close career coach" onClick={onClose} />}
        </div>
      </div>

      {hasAnalysis && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
          <Badge>{skills?.length || 0} skills</Badge>
          <Badge>ATS {atsScore ?? "–"}/100</Badge>
          {bestRole?.role && <Badge>{roleLabel(bestRole.role)}</Badge>}
          {next && <Badge tone="brand">Next: {formatSkill(next.skill)}</Badge>}
          {progress?.lastInterviewScore != null && <Badge tone="brand">Interview {progress.lastInterviewScore.toFixed(1)}/10</Badge>}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        <Message role="assistant" content={welcome} />
        {messages.map((message, index) => <Message key={index} {...message} />)}
        {loading && <p className="text-sm text-ink-muted">Thinking…</p>}
        {!messages.length && !loading && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((suggestion) => (
              <Button key={suggestion} size="sm" variant="secondary" onClick={() => send(suggestion)}>{suggestion}</Button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <InlineAlert className="mx-4 mb-3">{error}</InlineAlert>}

      <div className="shrink-0 border-t border-line p-3">
        <div className="flex items-end gap-2">
          <label htmlFor="coach-input" className="sr-only">Message the career coach</label>
          <textarea
            id="coach-input" ref={inputRef} value={input} rows={2}
            onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown}
            placeholder="Ask about your skill gaps, roadmap or ATS score"
            className="block max-h-32 min-h-[40px] w-full resize-none rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted"
          />
          <Button variant="primary" icon={Send} aria-label="Send" onClick={() => send()} disabled={loading || !input.trim()} />
        </div>
        <p className="mt-2 text-xs text-ink-muted">Replies come from Gemini and can be wrong. Check important advice.</p>
      </div>
    </aside>
  );
}
