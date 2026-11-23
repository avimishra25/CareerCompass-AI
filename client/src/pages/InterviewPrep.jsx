import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { ArrowRight, Circle, CircleCheck, CircleDot, Lightbulb, MessagesSquare, Mic, Play, Square, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, Button, Card, EmptyState, Icon, InlineAlert, LoadingState, PageHeader, ProgressBar, ScoreRing, Select, Textarea, charCount, cx } from "../components/ui";
import { ROLES } from "../constants/targetRoles";
import { formatSkill } from "../utils/format";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const errorMessage = (error, fallback) => error.response?.data?.error || error.response?.data?.message || fallback;

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
// What the question tests, as a badge: gaps and skills are shown as formatted skill names.
const TARGET = {
  gap: { label: "Targets gap", tone: "warning", skill: true },
  project: { label: "Targets project", tone: "brand", skill: false },
  skill: { label: "Targets skill", tone: "neutral", skill: true },
  topic: { label: "Topic", tone: "neutral", skill: false },
};
const MAX_ANSWER = 4000;
const MIN_WORDS = 15;

const wordCount = (text) => (text.trim().match(/\S+/g) || []).length;
const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const verdict = (score) => (score >= 8 ? "Strong answer" : score >= 6 ? "Good answer" : score >= 4 ? "Needs work" : "Weak answer");
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

function FeedbackPanel({ question }) {
  return (
    <section aria-label="AI feedback" className="mt-5 grid gap-6 border-t border-line pt-5 md:grid-cols-2">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <ScoreRing value={question.overall} max={10} size={64} />
          <div>
            <p className="text-base font-semibold text-ink">{verdict(question.overall)}</p>
            <p className="text-sm text-ink-muted">{question.shortAnswer ? `Scored without AI: under ${MIN_WORDS} words` : "AI feedback"}</p>
          </div>
        </div>
        <ul className="space-y-3">
          {RUBRIC.map(([key, label]) => {
            const value = question.scores?.[key] ?? 0;
            return (
              <li key={key}>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-secondary">{label}</span>
                  <span className="tabular font-medium text-ink">{value}/10</span>
                </div>
                <ProgressBar value={value} min={1} max={10} label={label} className="mt-1.5" />
              </li>
            );
          })}
        </ul>
      </div>
      <div className="space-y-5">
        {question.strengths?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-ink">Strengths</h3>
            <ul aria-label="Strengths" className="mt-2 space-y-2">
              {question.strengths.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-ink-secondary"><Icon icon={CircleCheck} className="mt-0.5 shrink-0 text-success" />{item}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-ink">Improve</h3>
          <ul aria-label="Improvements" className="mt-2 space-y-2">
            {question.improvements?.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-ink-secondary"><Icon icon={Lightbulb} className="mt-0.5 shrink-0 text-warning" />{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Model answer outline</h3>
          <p className="mt-2 text-sm text-ink-secondary">{question.modelAnswer}</p>
        </div>
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
  const answerTooLong = charCount(answer) > MAX_ANSWER;

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
  const target = TARGET[question?.targetKind] || TARGET.topic;
  const words = wordCount(answer);
  // Readiness comes from session history, so it shows with or without an open session.
  const readinessCard = (className) => (
    <Card as="section" aria-label="Interview readiness" padding="sm" className={className}>
      <p className="text-sm text-ink-muted">Interview readiness</p>
      {ready ? (
        <>
          <p className="mt-1"><span className="tabular text-xl font-semibold text-ink">{ready.score.toFixed(1)}</span><span className="text-sm text-ink-muted">/10</span></p>
          <p className="mt-1 text-sm text-ink-secondary">
            {ready.count === 1 ? "Your latest session" : `Average of last ${ready.count} sessions`}
          </p>
          {ready.change !== null && (
            <p className={cx("mt-1 flex items-center gap-1 text-sm font-medium", ready.change >= 0 ? "text-success" : "text-danger")}>
              <Icon icon={ready.change >= 0 ? TrendingUp : TrendingDown} />
              <span className="tabular">{ready.change >= 0 ? "+" : "−"}{Math.abs(ready.change).toFixed(1)}</span> vs previous 5
            </p>
          )}
        </>
      ) : <p className="mt-1 text-sm text-ink-secondary">Answer questions to see your readiness score.</p>}
    </Card>
  );

  return (
    <>
      <PageHeader title="Interview prep" description="Practise questions built from your resume and skill gaps, and get scored feedback on every answer." />
      {error && <InlineAlert className="mb-4" onDismiss={() => setError("")}>{error}</InlineAlert>}
      {focus && (
        <InlineAlert tone="info" className="mb-4" action={<Button size="sm" variant="ghost" onClick={() => setFocus(null)}>Clear</Button>}>
          {focus.jdMatchId
            ? `Your next session targets the job “${focus.jdTitle || "JD match"}”: its missing skills come first.`
            : "Your next session uses the analysis you just ran."}
        </InlineAlert>
      )}

      {/* With a session open, phones show the question first and the settings after it. */}
      <div className="flex flex-col gap-6">
      <Card as="form" onSubmit={start} aria-label="Session settings" className={cx(session && "order-last lg:order-none")}>
        {/* Full-width fields on a grid so role names are never cut off. */}
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <Select label="Role" value={role} onChange={(event) => setRole(event.target.value)} disabled={starting}
            options={ROLES.map(({ value, label }) => ({ value, label }))} />
          <Select label="Type" value={type} onChange={(event) => setType(event.target.value)} disabled={starting} options={TYPES} />
          <Select label="Difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} disabled={starting} options={DIFFICULTIES} />
          <Button type="submit" variant={session ? "secondary" : "primary"} icon={Play} loading={starting} disabled={loading}
            className="sm:col-span-3 sm:justify-self-start lg:col-span-1">
            {starting ? "Generating…" : "Start new session"}
          </Button>
        </div>
        {starting && <p role="status" className="mt-3 text-sm text-ink-muted">Writing 5 questions for this role. This takes a few seconds.</p>}
      </Card>

      {loading ? (
        <LoadingState label="Loading your sessions" />
      ) : !session ? (
        <div className="grid items-start gap-4 lg:grid-cols-[256px_minmax(0,1fr)] lg:gap-6">
          {readinessCard("lg:col-start-1 lg:row-start-1")}
          <Card className="lg:col-start-2 lg:row-start-1">
            <EmptyState icon={MessagesSquare} title="Start a session"
              description={hasAnalysis
                ? "Pick a role, type and difficulty above to get 5 questions built from your skills, gaps and projects."
                : "You have no resume analysis yet, so questions will be general. Analyze a resume for questions about your own projects."}
              action={!hasAnalysis && <Button onClick={() => onNavigate?.("analyze")}>Analyze resume</Button>} />
          </Card>
        </div>
      ) : (
        // Desktop: question rail and readiness on the left, the current question on the right.
        // Phone: a compact horizontal stepper, then the question, then readiness.
        // Row 1 hugs the question rail; row 2 takes the rest, so readiness sits right under the rail.
        <div className="grid items-start gap-4 lg:grid-cols-[256px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-6">
          <nav aria-label="Session questions" className="min-w-0 lg:col-start-1 lg:row-start-1">
            <p className="mb-2 hidden text-sm font-medium text-ink-secondary lg:block">Session · {session.questions.length} questions</p>
            <ol className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
              {session.questions.map((item, index) => {
                const current = item.qid === currentQid;
                const icon = item.answeredAt ? CircleCheck : current ? CircleDot : Circle;
                return (
                  <li key={item.qid} className="shrink-0">
                    <button type="button" onClick={() => select(item.qid)} aria-current={current ? "step" : undefined}
                      className={cx("flex w-full items-start gap-2 rounded-control border px-3 py-2 text-left text-sm transition-ui",
                        current ? "border-brand bg-brand-tint" : "border-line bg-surface hover:bg-hover")}>
                      <Icon icon={icon} className={cx("mt-0.5 shrink-0", item.answeredAt ? "text-success" : current ? "text-brand" : "text-ink-muted")} />
                      <span className="font-medium text-ink">Q{index + 1}</span>
                      <span className="hidden min-w-0 flex-1 text-ink-secondary lg:line-clamp-2">{item.text}</span>
                      <span className="tabular ml-auto text-ink-muted">{item.answeredAt ? item.overall.toFixed(1) : "–"}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {question && (
            <Card as="article" aria-label="Current question" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-ink-muted">Question {questionNumber} of {session.questions.length} · {QUESTION_TYPE[question.type]}</p>
                <Badge tone={target.tone}>{target.label}: {target.skill ? formatSkill(question.targets) : question.targets}</Badge>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-ink">{question.text}</h2>

              {question.answeredAt ? (
                <>
                  <h3 className="mt-4 text-sm font-medium text-ink-secondary">Your answer</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{question.answer || <span className="text-ink-muted">No answer given.</span>}</p>
                  <FeedbackPanel question={question} />
                  <div className="mt-5 border-t border-line pt-4">
                    {nextQid ? (
                      <Button variant="primary" iconRight={ArrowRight} onClick={() => select(nextQid)}>Next question</Button>
                    ) : (
                      <p className="text-sm font-medium text-ink">
                        Session complete · <span className="tabular">{session.overallScore?.toFixed(1)}/10</span>. Start a new session to keep practising.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <form onSubmit={submit} className="mt-4">
                  <Textarea label="Your answer" rows={8} value={answer} maxLength={MAX_ANSWER} disabled={submitting}
                    onChange={(event) => setAnswer(event.target.value)}
                    hint={listening ? "Listening. Speak your answer." : words < MIN_WORDS ? `Answers under ${MIN_WORDS} words score 1/10 without AI review.` : undefined} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="submit" variant="primary" loading={submitting} disabled={answerTooLong}>
                      {submitting ? "Scoring…" : "Submit answer"}
                    </Button>
                    {Recognition && (
                      <Button icon={listening ? Square : Mic} onClick={toggleVoice} disabled={submitting} aria-pressed={listening}>
                        {listening ? "Stop recording" : "Answer by voice"}
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </Card>
          )}

          {readinessCard("lg:col-start-1 lg:row-start-2")}
        </div>
      )}
      </div>
    </>
  );
}
