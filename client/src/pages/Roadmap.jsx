import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { TARGET_ROLES } from "../constants/targetRoles";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const errorMessage = (error, fallback) => error.response?.data?.error || error.response?.data?.message || fallback;

const ROLES = TARGET_ROLES.filter((role) => role.value);
const NEXT_STATUS = { todo: "progress", progress: "done", done: "todo" };
const STATUS = {
  todo:     { label: "○ Upcoming",    dot: "#c3c9de", style: { background: "rgba(136,146,180,0.12)", color: "#4a5278" } },
  progress: { label: "● In progress", dot: "#3b6ef8", style: { background: "rgba(59,110,248,0.1)",   color: "#3b6ef8" } },
  done:     { label: "✓ Completed",   dot: "#10b981", style: { background: "rgba(16,185,129,0.1)",   color: "#059669" } },
};
const font = "Plus Jakarta Sans, sans-serif";
const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)" };
const missPill = { display: "inline-block", background: "rgba(244,63,126,0.07)", borderColor: "rgba(244,63,126,0.2)", color: "#e11d63" };
const okPill = { display: "inline-block", background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.22)", color: "#059669" };
const defaultRole = (analysis) => {
  const role = analysis?.targetRole || analysis?.bestRole?.role;
  return ROLES.some((item) => item.value === role) ? role : ROLES[0].value;
};

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
      setError(errorMessage(err, "Roadmap generation unavailable. Try again."));
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
      setError(errorMessage(err, "Could not update milestone."));
    } finally {
      setUpdating(null);
    }
  };

  const milestones = roadmap?.milestones || [];
  const done = milestones.filter((item) => item.status === "done").length;
  const percent = milestones.length ? Math.round((done / milestones.length) * 100) : 0;
  // A gap stays open until every milestone for it is done (or it never fit into the plan).
  const remaining = (roadmap?.skillGaps || []).filter((skill) => {
    const items = milestones.filter((item) => item.skill === skill);
    return !items.length || items.some((item) => item.status !== "done");
  });
  const roleLabel = (value) => ROLES.find((role) => role.value === value)?.label || value;

  return (
    <main className="px-6 py-10 max-w-5xl mx-auto" style={{ color: "var(--text)", fontFamily: font }}>
      <h1 className="text-2xl font-extrabold">
        Career <em className="gradient-text" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}>Roadmap</em>
      </h1>
      <p className="text-sm mt-1.5 mb-6" style={{ color: "var(--text-2)" }}>
        A week-by-week plan generated from your skill gaps for the target role.
      </p>
      {error && <p role="alert" className="text-red-600 text-sm mb-4">{error}</p>}
      {notice && <p aria-live="polite" className="text-sm mb-4 font-medium" style={{ color: "#3b6ef8" }}>{notice}</p>}

      {loading ? <p role="status" className="text-sm">Loading your roadmap…</p> : !analyses.length ? (
        <div className="glass rounded-2xl p-6">
          <p className="text-sm mb-4" style={{ color: "var(--text-2)" }}>A roadmap is built from a resume analysis.</p>
          <button className="btn-primary px-5 py-3 rounded-xl text-sm" onClick={() => onNavigate("analyze")}>Upload a resume first</button>
        </div>
      ) : <>
        <form onSubmit={generate} className="glass rounded-2xl p-6 mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-end">
          <div>
            <label htmlFor="roadmap-role" style={labelStyle}>Target role</label>
            <select id="roadmap-role" className="input-glass block w-full rounded-xl px-3 py-2.5 mt-1.5 text-sm font-semibold" value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)} disabled={busy}>
              {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="roadmap-analysis" style={labelStyle}>Analysis</label>
            <select id="roadmap-analysis" className="input-glass block w-full rounded-xl px-3 py-2.5 mt-1.5 text-sm" value={analysisId}
              onChange={(event) => setAnalysisId(event.target.value)} disabled={busy}>
              {analyses.map((item) => <option key={item._id} value={item._id}>{item.resumeName} — {new Date(item.createdAt).toLocaleDateString()}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="roadmap-jd" style={labelStyle}>JD match (optional)</label>
            <select id="roadmap-jd" className="input-glass block w-full rounded-xl px-3 py-2.5 mt-1.5 text-sm" value={jdMatchId}
              onChange={(event) => setJdMatchId(event.target.value)} disabled={busy}>
              <option value="">None</option>
              {matches.map((item) => <option key={item._id} value={item._id}>{item.jdTitle} — {item.result.overall_match}/100</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="roadmap-hours" style={labelStyle}>Hours / week</label>
            <input id="roadmap-hours" type="number" min={2} max={40} step={1} className="input-glass block w-full rounded-xl px-3 py-2.5 mt-1.5 text-sm"
              value={hours} onChange={(event) => setHours(event.target.value)} disabled={busy} aria-describedby="hours-hint" />
            <span id="hours-hint" className={hoursValid ? "sr-only" : "text-red-600 text-xs"}>Between 2 and 40 hours</span>
          </div>
          <button className="btn-primary px-5 py-3 rounded-xl text-sm disabled:opacity-50" disabled={busy || !analysisId || !hoursValid}>
            {busy ? "Generating…" : roadmap ? "Regenerate ↻" : "Generate roadmap"}
          </button>
        </form>

        {!roadmap ? (
          <div className="glass rounded-2xl p-6 text-sm" style={{ color: "var(--text-2)" }}>
            No roadmap yet. Choose a target role and analysis, then generate your plan.
          </div>
        ) : roadmap.covered ? (
          <div className="glass rounded-2xl p-6" aria-label="Roadmap result">
            <p className="font-bold">You already cover the core skills for {roleLabel(roadmap.targetRole)}.</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>Pick a JD match to plan around a specific job's requirements.</p>
          </div>
        ) : <>
          <section className="grid gap-4 md:grid-cols-3 mb-5" aria-label="Roadmap summary">
            <div className="glass rounded-2xl p-5 text-center">
              <div className="text-2xl font-extrabold" style={{ color: "#6c63ff" }}>{milestones.length}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-3)" }}>Weeks planned</div>
            </div>
            <div className="glass rounded-2xl p-5 text-center">
              <div className="text-2xl font-extrabold" style={{ color: "#10b981" }}>{percent}%</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-3)" }}>Milestones completed</div>
              <div className="progress-track mt-2.5" role="progressbar" aria-label="Milestones completed"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div className="progress-fill" style={{ width: `${percent}%`, background: "linear-gradient(90deg,#10b981,#0ea5c9)" }} />
              </div>
            </div>
            <div className="glass rounded-2xl p-5 text-center">
              <div className="text-2xl font-extrabold" style={{ color: "#6c63ff" }}>{remaining.length}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-3)" }}>Skill gaps remaining</div>
              <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                {remaining.map((skill) => <span key={skill} className="skill-pill" style={missPill}>{skill}</span>)}
              </div>
            </div>
          </section>

          <ol aria-label="Roadmap milestones">
            {milestones.map((item, index) => {
              const status = STATUS[item.status] || STATUS.todo;
              return (
                <li key={item._id} className="flex gap-4">
                  <div className="flex flex-col items-center" aria-hidden="true">
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: status.dot, marginTop: 22, boxShadow: "0 0 0 4px rgba(59,110,248,0.08)" }} />
                    {index < milestones.length - 1 && <div style={{ flex: 1, width: 2, background: "rgba(180,190,220,0.5)", marginTop: 4 }} />}
                  </div>
                  <article className="glass rounded-2xl flex-1 mb-3.5" style={{ padding: "18px 20px" }}>
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div style={labelStyle}>Week {item.week}</div>
                        <h2 className="font-bold text-base mt-0.5">{item.skill}</h2>
                      </div>
                      <button type="button" className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap disabled:opacity-50"
                        style={status.style} disabled={updating === item._id} onClick={() => cycle(item)}
                        aria-label={`Week ${item.week} status: ${status.label.slice(2)}. Change status`}>
                        {status.label}
                      </button>
                    </div>
                    <p className="mt-2" style={{ fontSize: "12.5px", color: "var(--text-2)", lineHeight: 1.55 }}>{item.objective}</p>
                    <div className="mt-2.5 flex flex-wrap gap-6 text-xs">
                      <div>
                        <span style={labelStyle}>Resources</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {item.resources.map((resource) => <span key={resource} className="skill-pill" style={{ display: "inline-block" }}>{resource}</span>)}
                        </div>
                      </div>
                      <div>
                        <span style={labelStyle}>Mini-project</span>
                        <div className="mt-1"><span className="skill-pill" style={okPill}>{item.miniProject}</span></div>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </>}
      </>}
    </main>
  );
}
