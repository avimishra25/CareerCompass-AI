import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { ChevronDown, ChevronRight, Circle, CircleCheck, CircleDot, FileSearch, Map, RefreshCw } from "lucide-react";
import { Badge, Button, Card, EmptyState, Icon, InlineAlert, Input, LoadingState, PageHeader, ProgressBar, Select, cx } from "../components/ui";
import { ROLES, roleLabel } from "../constants/targetRoles";
import { formatSkill, longDate } from "../utils/format";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const errorMessage = (error, fallback) => error.response?.data?.error || error.response?.data?.message || fallback;

const NEXT_STATUS = { todo: "progress", progress: "done", done: "todo" };
// Visible action label for the one-click status change.
const ACTION = { todo: "Start", progress: "Mark done", done: "Reopen" };
const STATUS = {
  todo: { label: "Up next", icon: Circle, iconClass: "text-ink-muted", tone: "neutral" },
  progress: { label: "In progress", icon: CircleDot, iconClass: "text-brand", tone: "brand" },
  done: { label: "Done", icon: CircleCheck, iconClass: "text-success", tone: "success" },
};
const defaultRole = (analysis) => {
  const role = analysis?.targetRole || analysis?.bestRole?.role;
  return ROLES.some((item) => item.value === role) ? role : ROLES[0].value;
};
// Older roadmaps have no subtopic title.
const titleOf = (item) => item.title || formatSkill(item.skill);

function Milestone({ item, current, last, updating, onCycle }) {
  const status = STATUS[item.status] || STATUS.todo;
  // Finished weeks collapse to one line; the current week and upcoming weeks are open.
  const [open, setOpen] = useState(item.status !== "done");
  const detailsId = `week-${item._id}`;
  return (
    <li className="relative flex gap-4">
      <div className="flex flex-col items-center" aria-hidden="true">
        <Icon icon={status.icon} size={20} className={cx("mt-4 shrink-0 bg-page", status.iconClass)} />
        {!last && <div className="mt-1 w-px flex-1 bg-line-strong" />}
      </div>
      <Card as="article" padding="sm" aria-label={`Week ${item.week}: ${titleOf(item)}`}
        className={cx("mb-3 min-w-0 flex-1", current && "border-brand ring-1 ring-brand")}>
        <div className="flex flex-wrap items-start gap-3">
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={detailsId}
            className="flex min-w-0 flex-1 basis-56 items-start gap-2 rounded-control text-left">
            <Icon icon={open ? ChevronDown : ChevronRight} className="mt-0.5 shrink-0 text-ink-muted" />
            <span className="min-w-0">
              <span className="block text-sm text-ink-muted">Week {item.week}{current && " · current"}</span>
              <span className="block text-base font-semibold text-ink">{titleOf(item)}</span>
            </span>
          </button>
          <Badge tone={status.tone}>{status.label}</Badge>
          <Button size="sm" loading={updating} aria-label={`${ACTION[item.status]} week ${item.week}`}
            onClick={() => onCycle(item)}>
            {ACTION[item.status]}
          </Button>
        </div>
        {open && (
          <div id={detailsId} className="mt-3 space-y-3 pl-6">
            <p className="text-sm text-ink-secondary">{item.objective}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium text-ink">Free resources</h4>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {item.resources.map((resource) => <li key={resource}><Badge>{resource}</Badge></li>)}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-ink">Mini-project</h4>
                <p className="mt-1.5 text-sm text-ink-secondary">{item.miniProject}</p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </li>
  );
}

// `preset` comes from cross-links: { analysisId, targetRole } from an ATS report, or
// { analysisId, jdMatchId } from a JD match. It only pre-selects; generating stays a click.
export default function Roadmap({ onNavigate, preset }) {
  const presetRef = useRef(preset || {});
  const [notice, setNotice] = useState("");
  const [analyses, setAnalyses] = useState([]);
  const [matches, setMatches] = useState([]);
  const [roadmap, setRoadmap] = useState(null);
  const [analysisId, setAnalysisId] = useState("");
  const [jdMatchId, setJdMatchId] = useState("");
  const [targetRole, setTargetRole] = useState(ROLES[0].value);
  const [hours, setHours] = useState("8");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      axios.get(`${API}/api/history`, auth()),
      axios.get(`${API}/api/jd-match/history`, auth()),
      axios.get(`${API}/api/roadmap`, auth()),
    ])
      .then(([resumes, jd, latest]) => {
        if (!active) return;
        const list = Array.isArray(resumes.data) ? resumes.data : [];
        const jdList = Array.isArray(jd.data) ? jd.data : [];
        setAnalyses(list);
        setMatches(jdList);
        const saved = latest.data || null;
        setRoadmap(saved);
        const want = presetRef.current;
        const presetAnalysis = list.find((item) => item._id === want.analysisId);
        const presetMatch = jdList.find((item) => item._id === want.jdMatchId);
        const analysis = presetAnalysis || list.find((item) => item._id === saved?.analysisId) || list[0];
        setAnalysisId(analysis?._id || "");
        const presetRole = ROLES.some((role) => role.value === want.targetRole) ? want.targetRole : null;
        setTargetRole(presetRole || (presetAnalysis ? defaultRole(analysis) : saved?.targetRole || defaultRole(analysis)));
        setJdMatchId(presetMatch ? presetMatch._id : presetAnalysis ? "" : saved?.jdMatchId || "");
        if (saved?.hoursPerWeek) setHours(String(saved.hoursPerWeek));
        const action = saved ? "Regenerate" : "Generate";
        if (presetMatch) {
          setNotice(`JD match “${presetMatch.jdTitle}” is selected. ${action} to add its missing skills to your roadmap.`);
        } else if (presetAnalysis) {
          setNotice(`Your analysis “${presetAnalysis.resumeName}” is selected. ${action} to build a roadmap from it.`);
        }
      })
      .catch((err) => { if (active) setError(errorMessage(err, "Could not load your roadmap.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const hoursNumber = Number(hours);
  const hoursValid = Number.isInteger(hoursNumber) && hoursNumber >= 2 && hoursNumber <= 40;

  const generate = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = { analysisId, targetRole, hoursPerWeek: hoursNumber };
      if (jdMatchId) body.jdMatchId = jdMatchId;
      const { data } = await axios.post(`${API}/api/roadmap`, body, auth());
      setRoadmap(data);
      setNotice("");
    } catch (err) {
      setError(errorMessage(err, "Roadmap generation is unavailable. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const cycle = async (milestone) => {
    setError("");
    setUpdating(milestone._id);
    try {
      const { data } = await axios.patch(`${API}/api/roadmap/${roadmap._id}/milestone/${milestone._id}`,
        { status: NEXT_STATUS[milestone.status] }, auth());
      setRoadmap(data);
    } catch (err) {
      setError(errorMessage(err, "Could not update the milestone."));
    } finally {
      setUpdating(null);
    }
  };

  const milestones = roadmap?.milestones || [];
  const done = milestones.filter((item) => item.status === "done").length;
  const percent = milestones.length ? Math.round((done / milestones.length) * 100) : 0;
  const currentId = milestones.find((item) => item.status !== "done")?._id;
  // A gap stays open until every milestone for it is done (or it never fit into the plan).
  const remaining = (roadmap?.skillGaps || []).filter((skill) => {
    const items = milestones.filter((item) => item.skill === skill);
    return !items.length || items.some((item) => item.status !== "done");
  });

  return (
    <>
      <PageHeader title="Roadmap" description="A week-by-week plan for the skills your target role needs, prerequisites first." />
      {error && <InlineAlert className="mb-4" onDismiss={() => setError("")}>{error}</InlineAlert>}
      {notice && <InlineAlert tone="info" className="mb-4">{notice}</InlineAlert>}

      {loading ? <LoadingState label="Loading your roadmap" /> : !analyses.length ? (
        <Card>
          <EmptyState icon={FileSearch} title="Analyze a resume first" description="A roadmap is built from the skill gaps in a resume analysis."
            action={<Button variant="primary" onClick={() => onNavigate("analyze")}>Analyze resume</Button>} />
        </Card>
      ) : (
        <div className="space-y-6">
          <Card as="form" onSubmit={generate} aria-label="Roadmap settings">
            {/* Full-width fields on a grid so long role and file names are never cut off. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Target role" value={targetRole} onChange={(event) => setTargetRole(event.target.value)} disabled={busy}
                options={ROLES.map(({ value, label }) => ({ value, label }))} />
              <Select label="Analysis" value={analysisId} onChange={(event) => setAnalysisId(event.target.value)} disabled={busy}
                options={analyses.map((item) => ({ value: item._id, label: `${item.resumeName} · ${longDate(item.createdAt)}` }))} />
              <Select label="JD match (optional)" value={jdMatchId} onChange={(event) => setJdMatchId(event.target.value)} disabled={busy}
                options={[{ value: "", label: "None" }, ...matches.map((item) => ({ value: item._id, label: `${item.jdTitle} · ${item.result.overall_match}/100` }))]} />
              <Input label="Hours / week" type="number" min={2} max={40} step={1} value={hours} disabled={busy}
                onChange={(event) => setHours(event.target.value)} hint="Between 2 and 40 hours"
                error={hoursValid ? undefined : "Enter a whole number from 2 to 40"} />
            </div>
            <Button type="submit" variant="primary" icon={roadmap ? RefreshCw : Map} className="mt-4" loading={busy}
              disabled={busy || !analysisId || !hoursValid}>
              {busy ? "Generating…" : roadmap ? "Regenerate" : "Generate roadmap"}
            </Button>
          </Card>

          {!roadmap ? (
            <Card>
              <EmptyState icon={Map} title="No roadmap yet" description="Choose a target role and analysis above, then generate your plan." />
            </Card>
          ) : roadmap.covered || !milestones.length ? (
            <Card>
              <EmptyState icon={CircleCheck} title="You cover this role. Pick another role or add a JD match."
                description={`Your resume already has the core skills for ${roleLabel(roadmap.targetRole)}.`} />
            </Card>
          ) : (
            <>
              <Card as="section" aria-label="Roadmap summary">
                <dl className="grid gap-5 sm:grid-cols-3">
                  <div>
                    <dt className="text-sm text-ink-muted">Weeks planned</dt>
                    <dd className="tabular mt-1 text-xl font-semibold text-ink">{milestones.length}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-ink-muted">Completed</dt>
                    <dd className="mt-1">
                      <span className="tabular text-xl font-semibold text-ink">{percent}%</span>
                      <ProgressBar value={percent} label="Milestones completed" tone="success" className="mt-2" />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-ink-muted">Skill gaps remaining <span className="tabular">{remaining.length}</span></dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {remaining.length ? remaining.map((skill) => <Badge key={skill} tone="danger">{formatSkill(skill)}</Badge>)
                        : <span className="text-sm text-ink-secondary">None. Every gap is covered.</span>}
                    </dd>
                  </div>
                </dl>
              </Card>

              <ol aria-label="Roadmap milestones">
                {milestones.map((item, index) => (
                  <Milestone key={item._id} item={item} current={item._id === currentId} last={index === milestones.length - 1}
                    updating={updating === item._id} onCycle={cycle} />
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </>
  );
}
