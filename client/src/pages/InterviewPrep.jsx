import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { TARGET_ROLES } from "../constants/targetRoles";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const errorMessage = (error, fallback) => error.response?.data?.error || error.response?.data?.message || fallback;

const ROLES = TARGET_ROLES.filter((role) => role.value);
const TYPES = [
  { value: "mixed", label: "Technical + HR" },
  { value: "technical", label: "Technical" },
  { value: "hr", label: "HR" },
  { value: "behavioural", label: "Behavioural" },
];
const DIFFICULTIES = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];
const QUESTION_TYPE = { technical: "Technical", hr: "HR", behavioural: "Behavioural" };
const RUBRIC = [
  ["relevance", "Relevance"], ["technical_accuracy", "Technical accuracy"], ["structure", "Structure"],
  ["clarity", "Clarity"], ["depth", "Depth"],
];
const TARGET_BADGE = {
  gap:     { label: "targets gap",     style: { background: "rgba(14,165,201,0.1)",  color: "#0e7490" } },
  project: { label: "targets project", style: { background: "rgba(108,99,255,0.1)",  color: "#5b52e0" } },
  skill:   { label: "targets skill",   style: { background: "rgba(59,110,248,0.08)", color: "#3b6ef8" } },
  topic:   { label: "topic",           style: { background: "rgba(136,146,180,0.12)", color: "#4a5278" } },
};
const MAX_ANSWER = 4000;
const MIN_WORDS = 15;
const font = "Plus Jakarta Sans, sans-serif";
const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)" };
const small = { fontSize: "12.5px", color: "var(--text-2)", lineHeight: 1.55 };

const chars = (text) => [...text].length;
const wordCount = (text) => (text.trim().match(/\S+/g) || []).length;
const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const verdict = (score) => score >= 8 ? "Strong answer" : score >= 6 ? "Good answer" : score >= 4 ? "Needs work" : "Weak answer";
const speechRecognition = () => (typeof window === "undefined" ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);
const listItem = ({ _id, role, type, difficulty, status, overallScore, createdAt, updatedAt, questions }) => ({
  _id, role, type, difficulty, status, overallScore, createdAt, updatedAt,
  questions: questions.map(({ qid, overall, answeredAt }) => ({ qid, overall, answeredAt })),
});
const firstOpen = (session, after) => {
  const open = session.questions.filter((item) => !item.answeredAt);
  const index = session.questions.findIndex((item) => item.qid === after);
  return (open.find((item) => session.questions.indexOf(item) > index) || open[0])?.qid || null;
};

// Average overall score of the latest 5 scored sessions and the change versus the 5 before.
function readiness(history) {
  const scored = history.filter((item) => typeof item.overallScore === "number");
  const latest = scored.slice(0, 5).map((item) => item.overallScore);
  const previous = scored.slice(5, 10).map((item) => item.overallScore);
  if (!latest.length) return null;
  const score = average(latest);
  return { score, count: latest.length, change: previous.length ? score - average(previous) : null };
}

function ScoreRing({ score }) {
  const percent = Math.round(score * 10);
  return (
    <div role="img" aria-label={`Score ${score.toFixed(1)} out of 10`} className="flex items-center justify-center shrink-0"
      style={{ width: 58, height: 58, borderRadius: "50%", background: `conic-gradient(#3b6ef8 0 ${percent}%, rgba(59,110,248,0.12) ${percent}% 100%)` }}>
      <div className="flex items-center justify-center" style={{ width: 46, height: 46, borderRadius: "50%", background: "#f4f6fb" }}>
        <b style={{ color: "#3b6ef8" }}>{score.toFixed(1)}</b>
      </div>
    </div>
  );
}

function FeedbackPanel({ question }) {
  return (
    <section aria-label="AI feedback" className="grid gap-5 md:grid-cols-[1fr_1.25fr] mt-5 pt-4" style={{ borderTop: "1px solid rgba(180,190,220,0.4)" }}>
      <div>
        <div className="flex items-center gap-3 mb-3">
          <ScoreRing score={question.overall} />
          <div>
            <b>{verdict(question.overall)}</b>
            <div style={small}>{question.shortAnswer ? `Scored without AI: under ${MIN_WORDS} words` : "AI feedback"}</div>
          </div>
        </div>
        {RUBRIC.map(([key, label]) => {
          const value = question.scores?.[key] ?? 0;
          return (
            <div key={key} className="mb-2.5">
              <div className="flex justify-between" style={{ fontSize: "12.5px" }}><span>{label}</span><b>{value}/10</b></div>
              <div className="progress-track mt-1" role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={10} aria-valuenow={value}>
                <div className="progress-fill" style={{ width: `${value * 10}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div>
        {question.strengths?.length > 0 && <>
          <h3 style={{ ...labelStyle, color: "#059669" }}>Strengths</h3>
          <ul aria-label="Strengths" className="list-disc mt-1.5 mb-2.5 ml-4" style={small}>
            {question.strengths.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </>}
        <h3 style={{ ...labelStyle, color: "#e11d63" }}>Improve</h3>
        <ul aria-label="Improvements" className="list-disc mt-1.5 mb-2.5 ml-4" style={small}>
          {question.improvements?.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <h3 style={labelStyle}>Model answer outline</h3>
        <p className="mt-1.5" style={small}>{question.modelAnswer}</p>
      </div>
    </section>
  );
}

// `preset` comes from cross-links: { analysisId, role } from an ATS report, or
// { analysisId, jdMatchId, jdTitle } from a JD match. It focuses the next session started.
export default function InterviewPrep({ onNavigate, preset }) {
  const presetRef = useRef(preset || {});
  const [focus, setFocus] = useState(() => {
    const { analysisId, jdMatchId, jdTitle } = presetRef.current;
    return analysisId || jdMatchId ? { analysisId, jdMatchId, jdTitle } : null;
  });
  const [history, setHistory] = useState([]);
  const [hasAnalysis, setHasAnalysis] = useState(true);
  const [session, setSession] = useState(null);
  const [currentQid, setCurrentQid] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [role, setRole] = useState(ROLES[0].value);
  const [type, setType] = useState("mixed");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const Recognition = speechRecognition();

  useEffect(() => {
    let active = true;
    Promise.all([
      axios.get(`${API}/api/interview/history`, auth()),
      axios.get(`${API}/api/history`, auth()).catch(() => ({ data: [] })),
    ])
      .then(async ([sessions, analyses]) => {
        const list = Array.isArray(sessions.data) ? sessions.data : [];
        const latestAnalysis = Array.isArray(analyses.data) ? analyses.data[0] : null;
        if (!active) return;
        setHistory(list);
        setHasAnalysis(Boolean(latestAnalysis));
        const analysisRole = latestAnalysis?.targetRole || latestAnalysis?.bestRole?.role;
        const want = presetRef.current;
        const defaultRole = [want.role, list[0]?.role, analysisRole].find((value) => ROLES.some((item) => item.value === value));
        if (defaultRole) setRole(defaultRole);
        // Resume the latest unfinished session, unless a cross-link asked for a new focused one.
        if (list[0]?.status === "active" && !want.analysisId && !want.jdMatchId) {
          const { data } = await axios.get(`${API}/api/interview/${list[0]._id}`, auth());
          if (!active) return;
          setSession(data);
          setCurrentQid(firstOpen(data));
        }
      })
      .catch((err) => { if (active) setError(errorMessage(err, "Could not load your interview sessions.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const stopVoice = () => recognitionRef.current?.stop();

  const remember = (data) => {
    setSession(data);
    setHistory((items) => [listItem(data), ...items.filter((item) => item._id !== data._id)]);
  };

  const start = async (event) => {
    event.preventDefault();
    stopVoice();
    setError("");
    setStarting(true);
    try {
      const body = { role, type, difficulty };
      if (focus?.analysisId) body.analysisId = focus.analysisId;
      if (focus?.jdMatchId) body.jdMatchId = focus.jdMatchId;
      const { data } = await axios.post(`${API}/api/interview/start`, body, auth());
      remember(data);
      setFocus(null);
      setDrafts({});
      setCurrentQid(data.questions[0]?.qid || null);
    } catch (err) {
      setError(errorMessage(err, "Could not start a session. Try again."));
    } finally {
      setStarting(false);
    }
  };

  const question = session?.questions.find((item) => item.qid === currentQid) || null;
  const questionNumber = session ? session.questions.indexOf(question) + 1 : 0;
  const answer = drafts[currentQid] || "";
  const setAnswer = (value) => setDrafts((items) => ({ ...items, [currentQid]: value }));
  const answerTooLong = chars(answer) > MAX_ANSWER;

  const submit = async (event) => {
    event.preventDefault();
    stopVoice();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/api/interview/${session._id}/answer`, { qid: currentQid, answer }, auth());
      remember(data);
    } catch (err) {
      setError(errorMessage(err, "Answer evaluation unavailable. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const select = (qid) => {
    stopVoice();
    setError("");
    setCurrentQid(qid);
  };

  // Browser speech-to-text (Web Speech API). Transcripts are appended to the current answer.
  const toggleVoice = () => {
    if (listening) return stopVoice();
    const qid = currentQid;
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).slice(event.resultIndex)
        .filter((result) => result.isFinal).map((result) => result[0].transcript).join(" ").trim();
      if (!text) return;
      setDrafts((items) => {
        const current = (items[qid] || "").trimEnd();
        return { ...items, [qid]: [...(current ? `${current} ${text}` : text)].slice(0, MAX_ANSWER).join("") };
      });
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError(event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone access is blocked. Allow it in your browser to answer by voice."
        : "Voice input stopped. Try again or type your answer.");
    };
    recognition.onend = () => { recognitionRef.current = null; setListening(false); };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setError("Voice input could not start. Type your answer instead.");
    }
  };

  const ready = readiness(history);
  const nextQid = session && question?.answeredAt ? firstOpen(session, currentQid) : null;
  const badge = TARGET_BADGE[question?.targetKind] || TARGET_BADGE.topic;

  return (
    <main className="px-6 py-10 max-w-5xl mx-auto" style={{ color: "var(--text)", fontFamily: font }}>
      <h1 className="text-2xl font-extrabold">
        Interview <em className="gradient-text" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}>Prep</em>
      </h1>
      <p className="text-sm mt-1.5 mb-6" style={{ color: "var(--text-2)" }}>
        Practise role-specific questions generated from your resume and skill gaps, and get instant AI feedback.
      </p>
      {error && <p role="alert" className="text-red-600 text-sm mb-4">{error}</p>}
      {focus && (
        <div aria-live="polite" className="flex flex-wrap items-center gap-3 mb-4 text-sm font-medium" style={{ color: "#3b6ef8" }}>
          <span>{focus.jdMatchId
            ? `Your next session targets the job “${focus.jdTitle || "JD match"}”: its missing skills come first.`
            : "Your next session uses the analysis you just ran."}</span>
          <button type="button" className="btn-ghost px-3 py-1 rounded-lg text-xs" onClick={() => setFocus(null)}>Clear</button>
        </div>
      )}

      <form onSubmit={start} className="glass rounded-2xl mb-5 grid gap-3.5 md:grid-cols-[1.2fr_1fr_1fr_auto] items-end" style={{ padding: "18px 22px" }}>
        <div>
          <label htmlFor="interview-role" style={labelStyle}>Role</label>
          <select id="interview-role" className="input-glass block w-full rounded-xl px-3 py-2.5 mt-1.5 text-sm font-semibold" value={role}
            onChange={(event) => setRole(event.target.value)} disabled={starting}>
            {ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="interview-type" style={labelStyle}>Type</label>
          <select id="interview-type" className="input-glass block w-full rounded-xl px-3 py-2.5 mt-1.5 text-sm" value={type}
            onChange={(event) => setType(event.target.value)} disabled={starting}>
            {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="interview-difficulty" style={labelStyle}>Difficulty</label>
          <select id="interview-difficulty" className="input-glass block w-full rounded-xl px-3 py-2.5 mt-1.5 text-sm" value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)} disabled={starting}>
            {DIFFICULTIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <button className="btn-primary px-5 py-3 rounded-xl text-sm disabled:opacity-50" disabled={starting || loading}>
          {starting ? "Generating…" : "Start new session"}
        </button>
      </form>

      {loading ? <p role="status" className="text-sm">Loading your sessions…</p> : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.55fr] items-start">
          <div>
            {session && (
              <nav aria-label="Session questions" className="glass rounded-2xl p-6 mb-4">
                <div style={labelStyle} className="mb-2.5">Session · {session.questions.length} questions</div>
                {session.questions.map((item, index) => {
                  const current = item.qid === currentQid;
                  const color = item.answeredAt ? "#10b981" : current ? "#3b6ef8" : "var(--text-3)";
                  return (
                    <button key={item.qid} type="button" onClick={() => select(item.qid)} aria-current={current ? "step" : undefined}
                      className="w-full flex gap-2.5 text-left rounded-xl mb-2" style={{
                        padding: "10px 12px",
                        background: current ? "rgba(59,110,248,0.08)" : "transparent",
                        border: `1px solid ${current ? "rgba(59,110,248,0.25)" : "rgba(180,190,220,0.35)"}`,
                      }}>
                      <b style={{ color }}>Q{index + 1}</b>
                      <span className="flex-1" style={{ fontSize: "12.5px", color: item.answeredAt || current ? "var(--text)" : "var(--text-3)" }}>{item.text}</span>
                      <b style={{ fontSize: 12, color: "var(--text-2)" }}>{item.answeredAt ? item.overall.toFixed(1) : "–"}</b>
                    </button>
                  );
                })}
              </nav>
            )}
            <section aria-label="Interview readiness" className="glass rounded-2xl text-center" style={{ padding: 18 }}>
              <div className="text-xs mb-1.5" style={{ color: "var(--text-3)" }}>Interview readiness</div>
              {ready ? <>
                <div className="text-2xl font-extrabold" style={{ color: "#6c63ff" }}>
                  {ready.score.toFixed(1)}<span className="text-sm" style={{ color: "var(--text-3)" }}>/10</span>
                </div>
                <div className="mt-1" style={small}>
                  Average of {ready.count === 1 ? "your latest session" : `last ${ready.count} sessions`}
                  {ready.change !== null && ` · ${ready.change >= 0 ? "▲" : "▼"} ${Math.abs(ready.change).toFixed(1)} vs previous 5`}
                </div>
              </> : <div style={small}>Answer questions to see your readiness score.</div>}
            </section>
          </div>

          {!question ? (
            <div className="glass rounded-2xl p-6" style={small}>
              <p>Start a session to get 5 questions for your role, built from your resume skills, skill gaps and projects.</p>
              {!hasAnalysis && <>
                <p className="mt-2">You have no resume analysis yet, so questions will be general.</p>
                <button type="button" className="btn-ghost px-4 py-2 rounded-xl text-sm mt-3" onClick={() => onNavigate?.("analyze")}>Analyze a resume</button>
              </>}
            </div>
          ) : (
            <article aria-label="Current question" className="glass rounded-2xl p-6">
              <div className="flex justify-between items-start gap-3">
                <div style={labelStyle}>Question {questionNumber} of {session.questions.length} · {QUESTION_TYPE[question.type]}</div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap" style={badge.style}>
                  {badge.label}: {question.targets}
                </span>
              </div>
              <h2 className="font-bold text-base mt-2">{question.text}</h2>

              {question.answeredAt ? <>
                <div className="mt-3 text-xs" style={{ color: "var(--text-3)" }}>Your answer</div>
                <p className="mt-1.5 whitespace-pre-wrap" style={small}>{question.answer || <em>No answer given.</em>}</p>
                <FeedbackPanel question={question} />
                <div className="mt-4">
                  {nextQid ? (
                    <button type="button" className="btn-primary px-4 py-2.5 rounded-xl text-sm" onClick={() => select(nextQid)}>Next question →</button>
                  ) : (
                    <p className="text-sm font-semibold">
                      Session complete · {session.overallScore?.toFixed(1)}/10. Start a new session to keep practising.
                    </p>
                  )}
                </div>
              </> : (
                <form onSubmit={submit}>
                  <label htmlFor="interview-answer" className="block mt-3 text-xs" style={{ color: "var(--text-3)" }}>Your answer</label>
                  <textarea id="interview-answer" rows={7} className="input-glass block w-full rounded-xl px-3 py-2.5 mt-1.5"
                    style={{ fontSize: "12.5px", lineHeight: 1.5 }} value={answer} disabled={submitting}
                    onChange={(event) => setAnswer(event.target.value)} aria-describedby="answer-hint" />
                  <div id="answer-hint" className="flex justify-between gap-3 mt-1 text-xs" style={{ color: answerTooLong ? "#dc2626" : "var(--text-3)" }}>
                    <span>{wordCount(answer) < MIN_WORDS ? `Answers under ${MIN_WORDS} words score 1/10 without AI review.` : listening ? "Listening… speak your answer." : ""}</span>
                    <span>{chars(answer)}/{MAX_ANSWER}</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5 mt-2.5">
                    {Recognition && (
                      <button type="button" className="btn-ghost px-4 py-2 rounded-xl text-sm" onClick={toggleVoice} disabled={submitting}
                        aria-pressed={listening}>
                        {listening ? "■ Stop recording" : "🎤 Answer by voice"}
                      </button>
                    )}
                    <button className="btn-primary px-4 py-2 rounded-xl text-sm disabled:opacity-50" disabled={submitting || answerTooLong}>
                      {submitting ? "Scoring…" : "Submit answer"}
                    </button>
                  </div>
                </form>
              )}
            </article>
          )}
        </div>
      )}
    </main>
  );
}
