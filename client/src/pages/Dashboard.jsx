import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import ProgressTracker from "../components/ProgressTracker";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const font = "Plus Jakarta Sans, sans-serif";
const statLabel = { color: "var(--text-3)", fontFamily: font };

function StatCard({ value, label, detail, onClick, children, small = false }) {
  return (
    <button type="button" onClick={onClick} className="glass rounded-2xl p-5 text-center w-full">
      <p className={`${small ? "text-lg capitalize" : "text-3xl"} font-extrabold gradient-text`} style={{ fontFamily: font }}>{value}</p>
      <p className="text-xs mt-1" style={statLabel}>{label}</p>
      {children}
      {detail && <p className="text-xs mt-1.5" style={{ color: "var(--text-2)", fontFamily: font }}>{detail}</p>}
    </button>
  );
}

export default function Dashboard({ onNavigate }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    let active = true;
    axios.get(`${API}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then(({ data }) => { if (active) setSummary(data); })
      .catch(() => { if (active) setError("Could not load your dashboard stats."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const firstName = user?.name?.split(" ")[0] || "there";
  const show = (value, format = (v) => v) => (loading ? "—" : value == null ? "—" : format(value));
  const analyses = summary?.analyses;
  const roadmap = summary?.roadmap;
  const interview = summary?.interview;
  const next = roadmap?.nextMilestone;

  const featureCards = [
    { emoji: "🧠", title: "NLP Skill Extraction",   desc: "spaCy + TF-IDF ranks your skills by relevance from your resume text." },
    { emoji: "🎯", title: "Target Role Analysis",   desc: "Set your goal role and see exactly how far you are from your dream job." },
    { emoji: "⚠️", title: "Skill Gap Analysis",      desc: "See exactly which skills you're missing for each career path." },
    { emoji: "📊", title: "ATS Score",               desc: "Get an ATS readiness score with a detailed breakdown and tips to improve." },
    { emoji: "🗺️", title: "Career Roadmap",          desc: "A week-by-week plan for your skill gaps, prerequisites first, with free resources." },
    { emoji: "📝", title: "AI Resume Builder",       desc: "Turn rough notes into action-verb bullets, watch your ATS score live, export an A4 PDF." },
    { emoji: "🎤", title: "Interview Prep",          desc: "Practise questions on your gaps and projects and get rubric-based AI feedback." },
    { emoji: "🕓", title: "Analysis History",        desc: "Every analysis is saved so you can track your growth over time." },
    { emoji: "🔐", title: "Secure & Private",        desc: "Your data is protected with JWT auth and stored under your account only." },
  ];

  const actions = [
    {
      page: "roadmap", emoji: "🗺️", title: "Career Roadmap",
      desc: next ? `Next: week ${next.week} · ${next.skill}` : roadmap ? "All milestones complete — regenerate for a new role." : "Turn your skill gaps into a week-by-week plan.",
    },
    { page: "resume-builder", emoji: "📝", title: "AI Resume Builder", desc: "Write rough notes and let AI turn them into ATS-friendly bullets." },
    {
      page: "interview", emoji: "🎤", title: "Interview Prep",
      desc: interview ? `Last session ${interview.lastScore.toFixed(1)}/10 — keep practising.` : "Practise questions on your gaps and projects.",
    },
  ];

  const sampleSkills = ["react", "python", "node", "mongodb", "express", "git", "javascript", "flask"];
  const sampleRoles  = [
    { emoji: "💻", role: "Fullstack Developer", score: 84 },
    { emoji: "⚙️", role: "Backend Developer",  score: 72 },
    { emoji: "📊", role: "Data Scientist",      score: 45 },
  ];

  return (
    <div className="px-6 py-10 max-w-6xl mx-auto space-y-10">

      {/* ── Welcome Header ── */}
      <div className="glass rounded-3xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Welcome back
          </p>
          <h1 className="text-3xl font-extrabold mb-2"
            style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Hey, {firstName} 👋
          </h1>
          <p className="text-sm" style={{ color: "var(--text-2)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Ready to discover your best career path? Upload your resume and get instant AI-powered insights.
          </p>
        </div>
        <button
          onClick={() => onNavigate("analyze")}
          className="btn-primary px-8 py-3.5 rounded-xl text-sm whitespace-nowrap">
          Analyze My Resume →
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {/* ── Stats (one GET /api/dashboard/summary request) ── */}
      <section aria-label="Your stats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard value={show(analyses?.count)} label="Analyses Done" onClick={() => onNavigate("history")} />
        <StatCard small value={loading ? "—" : analyses?.topRole || "None yet"} label="Top Matched Role" onClick={() => onNavigate("history")} />
        <StatCard value={show(analyses?.averageAts)} label="Avg ATS Score" onClick={() => onNavigate("history")}
          detail={analyses?.latestAts != null ? `Latest: ${analyses.latestAts}` : null} />
        <StatCard small label="Last Analysis" onClick={() => onNavigate("analyze")}
          value={loading ? "—" : analyses?.latestAnalysisAt
            ? new Date(analyses.latestAnalysisAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
            : "Never"} />
        <StatCard value={show(summary?.jdMatches.count)} label="JD Matches" onClick={() => onNavigate("jd-match")} />
        <StatCard value={show(summary?.jdMatches.best, (best) => `${best}/100`)} label="Best JD Match" onClick={() => onNavigate("jd-match")} />
        <StatCard value={show(roadmap?.completion, (value) => `${value}%`)} label="Roadmap Completion" onClick={() => onNavigate("roadmap")}
          detail={loading ? null : next ? `Next: week ${next.week} · ${next.skill}` : roadmap ? "All milestones done" : "No roadmap yet"}>
          {roadmap && (
            <div className="progress-track mt-2" role="progressbar" aria-label="Roadmap completion"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={roadmap.completion}>
              <div className="progress-fill" style={{ width: `${roadmap.completion}%`, background: "linear-gradient(90deg,#10b981,#0ea5c9)" }} />
            </div>
          )}
        </StatCard>
        <StatCard value={show(interview?.readiness, (value) => `${value.toFixed(1)}/10`)} label="Interview Readiness" onClick={() => onNavigate("interview")}
          detail={loading ? null : !interview ? "No sessions yet"
            : interview.change != null ? `${interview.change >= 0 ? "▲" : "▼"} ${Math.abs(interview.change).toFixed(1)} vs previous 5`
              : `Average of ${interview.sessions} session${interview.sessions === 1 ? "" : "s"}`} />
      </section>

      {/* ── Quick actions for the career tools ── */}
      <section aria-label="Quick actions" className="grid md:grid-cols-3 gap-4">
        {actions.map(({ page, emoji, title, desc }) => (
          <button key={page} type="button" onClick={() => onNavigate(page)}
            className="glass rounded-2xl p-5 text-left hover:scale-[1.02] transition-transform duration-200">
            <div className="text-2xl mb-2" aria-hidden="true">{emoji}</div>
            <h2 className="font-bold text-sm" style={{ color: "var(--text)", fontFamily: font }}>{title} →</h2>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-2)", fontFamily: font }}>{desc}</p>
          </button>
        ))}
      </section>

      {/* ── Progress Tracker (only renders if 2+ analyses exist) ── */}
      {!loading && analyses?.count >= 2 && (
        <ProgressTracker />
      )}

      {/* ── Preview Section ── */}
      <div className="glass rounded-3xl p-8">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1"
          style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          Sample Result Preview
        </p>
        <h2 className="text-xl font-bold mb-6"
          style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          Here's what your analysis will look like
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div style={{ background: "rgba(255,255,255,0.5)", borderRadius: "16px", padding: "20px" }}>
            <p className="text-sm font-bold mb-3 flex items-center gap-2"
              style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              🧠 Extracted Skills
              <span className="ml-auto text-xs font-normal" style={{ color: "var(--text-3)" }}>
                {sampleSkills.length} found
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {sampleSkills.map((s, i) => (
                <span key={i} className="skill-pill">{s}</span>
              ))}
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.5)", borderRadius: "16px", padding: "20px" }}>
            <p className="text-sm font-bold mb-4"
              style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              🎯 Career Match
            </p>
            <div className="space-y-4">
              {sampleRoles.map(({ emoji, role, score }) => (
                <div key={role}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium capitalize"
                      style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                      {emoji} {role}
                    </span>
                    <span className="text-sm font-bold" style={{ color: "#3b6ef8" }}>{score}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill"
                      style={{ width: `${score}%`, background: "linear-gradient(90deg,#3b6ef8,#6c63ff)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate("analyze")}
          className="btn-primary w-full mt-6 py-3.5 rounded-xl text-sm">
          Get Your Real Analysis →
        </button>
      </div>

      {/* ── Feature Cards ── */}
      <div>
        <h2 className="text-xl font-bold mb-6"
          style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          What CareerCompass AI does for you
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {featureCards.map(({ emoji, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-5">
              <div className="text-2xl mb-3">{emoji}</div>
              <h3 className="font-bold text-sm mb-2"
                style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                {title}
              </h3>
              <p className="text-xs leading-relaxed"
                style={{ color: "var(--text-2)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick Links ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Analyze Resume", emoji: "📄", page: "analyze"  },
          { label: "View History",   emoji: "🕓", page: "history"  },
          { label: "Compare",        emoji: "🔀", page: "history"  },
          { label: "About Project",  emoji: "ℹ️",  page: "about"    },
        ].map(({ label, emoji, page }) => (
          <button key={label}
            onClick={() => onNavigate(page)}
            className="glass rounded-2xl p-5 text-center hover:scale-105 transition-transform duration-200">
            <div className="text-2xl mb-2">{emoji}</div>
            <p className="text-xs font-semibold"
              style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              {label}
            </p>
          </button>
        ))}
      </div>

      {/* Footer */}
      <footer className="text-center py-6" style={{ borderTop: "1px solid rgba(180,190,220,0.3)" }}>
        <p className="text-xs" style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          © 2026 CareerCompass AI · Built by Avi Mishra
        </p>
      </footer>

    </div>
  );
}
