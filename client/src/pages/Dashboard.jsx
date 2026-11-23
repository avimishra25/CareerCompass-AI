import React, { useCallback, useEffect, useId, useState } from "react";
import axios from "axios";
import { ArrowRight, FilePen, FileSearch, Gauge, Map, MessagesSquare, Target, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import ProgressTracker from "../components/ProgressTracker";
import { Badge, Button, Card, EmptyState, Icon, InlineAlert, PageHeader, ProgressBar, Skeleton } from "../components/ui";
import { roleLabel } from "../constants/targetRoles";

import { formatSkill, shortDate } from "../utils/format";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

function greeting(date = new Date()) {
  const hour = date.getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

// A signed change as a badge: green up, red down, neutral when unchanged.
function Change({ value, suffix, decimals = 0 }) {
  if (value == null) return null;
  const rounded = Number(value.toFixed(decimals));
  if (rounded === 0) return <Badge>No change {suffix}</Badge>;
  const up = rounded > 0;
  return (
    <Badge tone={up ? "success" : "danger"} icon={up ? TrendingUp : TrendingDown}>
      <span className="tabular">{up ? "+" : "−"}{Math.abs(rounded).toFixed(decimals)}</span> {suffix}
    </Badge>
  );
}

function Kpi({ icon, label, value, unit, onClick, footer, loading }) {
  const footerId = useId();
  return (
    <Card as="button" type="button" onClick={onClick} padding="sm"
      aria-label={loading ? `${label}, loading` : `${label} ${value != null ? `${value}${unit || ""}` : "not available"}`}
      aria-describedby={footer && !loading ? footerId : undefined}
      className="flex w-full flex-col text-left transition-ui hover:border-line-strong">
      <span className="flex items-center gap-2 text-sm font-medium text-ink-secondary">
        <Icon icon={icon} className="text-ink-muted" /> {label}
      </span>
      {loading ? <Skeleton className="mt-3 h-8 w-24" /> : (
        <span className="mt-2 flex items-baseline gap-1">
          <span className="tabular text-xl font-semibold text-ink">{value ?? "–"}</span>
          {value != null && unit && <span className="tabular text-sm text-ink-muted">{unit}</span>}
        </span>
      )}
      <span id={footerId} className="mt-2 min-h-6 text-sm text-ink-muted">{!loading && footer}</span>
    </Card>
  );
}

function ContinueRow({ icon, title, meta, status, action, onClick }) {
  return (
    // On phones the button wraps under the text (aligned with it) instead of squeezing it.
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-hover text-ink-secondary">
        <Icon icon={icon} />
      </span>
      <span className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">{title}</span>
          {status}
        </span>
        <span className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{meta}</span>
      </span>
      <Button size="sm" onClick={onClick} aria-label={`${action}: ${title}`} className="ml-12 sm:ml-0">{action}</Button>
    </li>
  );
}

export default function Dashboard({ onNavigate }) {
  const { user } = useAuth();
  const { history } = useAppData();
  const [summary, setSummary] = useState(null);
  const [session, setSession] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    // Optional extras (unfinished interview, latest draft) never block the summary.
    return Promise.allSettled([
      axios.get(`${API}/api/dashboard/summary`, auth()),
      axios.get(`${API}/api/interview/history`, auth()),
      axios.get(`${API}/api/resume-builder/drafts`, auth()),
    ]).then(([summaryResult, sessionsResult, draftsResult]) => {
      if (summaryResult.status === "fulfilled") setSummary(summaryResult.value.data);
      else setError("Could not load your dashboard.");
      const sessions = sessionsResult.status === "fulfilled" && Array.isArray(sessionsResult.value?.data) ? sessionsResult.value.data : [];
      setSession(sessions.find((item) => item.status === "active") || null);
      const drafts = draftsResult.status === "fulfilled" && Array.isArray(draftsResult.value?.data) ? draftsResult.value.data : [];
      setDraft(drafts[0] || null);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const firstName = user?.name?.split(" ")[0] || "there";
  const analyses = summary?.analyses;
  const roadmap = summary?.roadmap;
  const interview = summary?.interview;
  const next = roadmap?.nextMilestone;
  // ATS change since the previous analysis that has a score (history is newest first).
  const scored = (history || []).map((item) => item.atsScore).filter(Number.isFinite);
  const atsChange = scored.length >= 2 ? scored[0] - scored[1] : null;
  const answered = session?.questions?.filter((item) => item.answeredAt).length ?? 0;

  const primary = !analyses?.count
    ? { label: "Analyze resume", icon: FileSearch, page: "analyze" }
    : next ? { label: "Continue roadmap", icon: Map, page: "roadmap" }
      : session ? { label: "Resume interview", icon: MessagesSquare, page: "interview" }
        : { label: "Practise interview", icon: MessagesSquare, page: "interview" };

  const header = (
    <PageHeader
      title={`${greeting()}, ${firstName}`}
      description="Where your resume stands and what to work on next."
      actions={!loading && !error && <Button variant="primary" icon={primary.icon} onClick={() => onNavigate(primary.page)}>{primary.label}</Button>}
    />
  );

  if (error) {
    return (
      <>
        {header}
        <InlineAlert title={error} action={<Button size="sm" onClick={load}>Try again</Button>}>
          Check your connection, then try again.
        </InlineAlert>
      </>
    );
  }

  if (!loading && !analyses?.count) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={FileSearch}
            title="Analyze your first resume"
            description="Upload a PDF to get your ATS score, skill gaps and role matches. Everything else builds on it."
            action={<Button variant="primary" onClick={() => onNavigate("analyze")}>Analyze resume</Button>}
          />
        </Card>
      </>
    );
  }

  const continueRows = [
    next && {
      key: "roadmap", icon: Map, title: `Week ${next.week} · ${formatSkill(next.skill)}`, meta: next.objective,
      status: next.status === "progress" ? <Badge tone="brand">In progress</Badge> : <Badge>Up next</Badge>,
      action: "Open roadmap", page: "roadmap",
    },
    session && {
      key: "interview", icon: MessagesSquare, title: `Interview session · ${roleLabel(session.role)}`,
      meta: `${answered} of ${session.questions?.length || 5} questions answered · started ${shortDate(session.createdAt)}`,
      status: <Badge tone="warning">Unfinished</Badge>, action: "Resume session", page: "interview",
    },
    draft && {
      key: "draft", icon: FilePen, title: draft.title,
      meta: `Edited ${shortDate(draft.updatedAt)}${draft.atsScore != null ? ` · ATS ${draft.atsScore}` : ""}`,
      action: "Open draft", page: "resume-builder",
    },
  ].filter(Boolean);

  return (
    <>
      {header}

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Gauge} label="ATS score" value={analyses?.latestAts} unit="/100" loading={loading} onClick={() => onNavigate("history")}
          footer={atsChange != null ? <Change value={atsChange} suffix="since last analysis" /> : analyses?.count === 1 ? "Your first analysis" : null} />
        <Kpi icon={Map} label="Roadmap progress" value={roadmap ? `${roadmap.completion}%` : null} loading={loading} onClick={() => onNavigate("roadmap")}
          footer={roadmap
            ? <span className="flex items-center gap-3"><ProgressBar value={roadmap.completion} label="Roadmap progress" className="max-w-24" /><span className="tabular">{roadmap.done} of {roadmap.total} weeks</span></span>
            : "No roadmap yet"} />
        <Kpi icon={MessagesSquare} label="Interview readiness" value={interview ? interview.readiness.toFixed(1) : null} unit="/10" loading={loading}
          onClick={() => onNavigate("interview")}
          footer={!interview ? "No sessions yet"
            : interview.change != null ? <Change value={interview.change} decimals={1} suffix="vs previous 5" />
              : `Average of ${interview.sessions} session${interview.sessions === 1 ? "" : "s"}`} />
        <Kpi icon={Target} label="Best JD match" value={summary?.jdMatches.best} unit="/100" loading={loading} onClick={() => onNavigate("jd-match")}
          footer={summary?.jdMatches.count ? `Across ${summary.jdMatches.count} job description${summary.jdMatches.count === 1 ? "" : "s"}` : "No matches yet"} />
      </section>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <Card as="section" title="Continue where you left off" className="min-w-0">
          {loading ? <Skeleton lines={3} className="h-10" label="Loading your recent work" /> : continueRows.length ? (
            <ul className="divide-y divide-line">
              {continueRows.map(({ key, page, ...row }) => <ContinueRow key={key} {...row} onClick={() => onNavigate(page)} />)}
            </ul>
          ) : (
            <EmptyState icon={Map} className="py-6" title="Nothing in progress"
              description="Generate a roadmap or start an interview session and it will show up here."
              action={<Button iconRight={ArrowRight} onClick={() => onNavigate("roadmap")}>Generate roadmap</Button>} />
          )}
        </Card>
        <div className="min-w-0">
          {(analyses?.count ?? 0) >= 2 ? <ProgressTracker /> : (
            <Card title="Progress over time">
              <p className="text-sm text-ink-muted">Analyze an updated resume to see how your score changes over time.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
