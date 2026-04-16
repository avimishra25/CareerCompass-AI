import React, { useMemo } from "react";

// ── Helpers ──────────────────────────────────────────────────
function scoreBadgeStyle(score) {
  if (score >= 75) return { color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)"  };
  if (score >= 50) return { color: "#3b6ef8",  bg: "rgba(59,110,248,0.1)",  border: "rgba(59,110,248,0.25)"  };
  if (score >= 30) return { color: "#f59e0b",  bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)"  };
  return               { color: "#ef4444",  bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)"   };
}

function DeltaBadge({ delta }) {
  if (delta === 0) return (
    <span style={{ fontSize: "0.72rem", color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      no change
    </span>
  );
  const positive = delta > 0;
  return (
    <span style={{
      fontSize: "0.72rem", fontWeight: 700,
      color:      positive ? "#10b981" : "#ef4444",
      background: positive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
      border:     `1px solid ${positive ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
      borderRadius: 999, padding: "2px 8px",
      fontFamily: "Plus Jakarta Sans, sans-serif",
    }}>
      {positive ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}

function MiniBar({ score, highlight }) {
  return (
    <div style={{ background: "rgba(180,190,220,0.15)", borderRadius: 999, height: 5, overflow: "hidden", marginTop: 4 }}>
      <div style={{
        height: "100%", borderRadius: 999,
        width: `${score}%`,
        background: highlight
          ? "linear-gradient(90deg,#3b6ef8,#6c63ff)"
          : "rgba(180,190,220,0.4)",
        transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
      }} />
    </div>
  );
}

function StatCard({ label, valueA, valueB, delta, unit = "" }) {
  const styleB = scoreBadgeStyle(typeof valueB === "number" ? valueB : 0);
  return (
    <div style={{
      background: "rgba(255,255,255,0.45)",
      border: "1px solid rgba(180,190,220,0.3)",
      borderRadius: 14, padding: "14px 16px",
    }}>
      <p style={{ fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em",
        color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif", marginBottom: 8 }}>
        {label}
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-2)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          {valueA}{unit}
        </span>
        <span style={{ color: "var(--text-3)", fontSize: "0.75rem" }}>→</span>
        <span style={{
          fontSize: "0.95rem", fontWeight: 700,
          color: styleB.color, fontFamily: "Plus Jakarta Sans, sans-serif",
        }}>
          {valueB}{unit}
        </span>
        <DeltaBadge delta={delta} />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function Compare({ analysisA, analysisB, onNavigate }) {
  // ── All hooks MUST come before any early returns ──
  const sharedRoles = useMemo(() => {
    if (!analysisA || !analysisB) return [];
    const matchA = analysisA.match || {};
    const matchB = analysisB.match || {};
    const allRoles = [...new Set([...Object.keys(matchA), ...Object.keys(matchB)])];
    return allRoles
      .map(r => ({
        role:   r,
        scoreA: parseInt(matchA[r]?.score || 0),
        scoreB: parseInt(matchB[r]?.score || 0),
        emoji:  matchA[r]?.emoji || matchB[r]?.emoji || "💼",
      }))
      .sort((a, b) => Math.max(b.scoreA, b.scoreB) - Math.max(a.scoreA, a.scoreB))
      .slice(0, 6);
  }, [analysisA, analysisB]);

  // Guard — early return AFTER all hooks
  if (!analysisA || !analysisB) {
    return (
      <div className="min-h-screen px-6 py-12 flex items-center justify-center">
        <div className="glass rounded-3xl p-12 text-center">
          <div className="text-4xl mb-4">🔀</div>
          <p style={{ color: "var(--text-2)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            No analyses selected for comparison.
          </p>
          <button onClick={() => onNavigate("history")}
            className="btn-primary mt-6 px-6 py-2.5 rounded-xl text-sm">
            Go to History
          </button>
        </div>
      </div>
    );
  }

  const skillsA = new Set(analysisA.skills || []);
  const skillsB = new Set(analysisB.skills || []);

  const gained  = [...skillsB].filter(s => !skillsA.has(s));
  const lost    = [...skillsA].filter(s => !skillsB.has(s));
  const common  = [...skillsA].filter(s =>  skillsB.has(s));

  const atsA = analysisA.atsScore ?? null;
  const atsB = analysisB.atsScore ?? null;
  const atsDelta = (atsA != null && atsB != null) ? atsB - atsA : null;

  const skillDelta = skillsB.size - skillsA.size;

  const roleA     = analysisA.bestRole?.role  || "—";
  const roleB     = analysisB.bestRole?.role  || "—";
  const scoreA    = analysisA.bestRole?.score ?? 0;
  const scoreB    = analysisB.bestRole?.score ?? 0;
  const roleDelta = scoreB - scoreA;

  const dateA = new Date(analysisA.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const dateB = new Date(analysisB.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <div>
            <button onClick={() => onNavigate("history")}
              className="flex items-center gap-1.5 text-xs mb-3 transition"
              style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              ← Back to History
            </button>
            <h1 className="text-3xl font-bold"
              style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Resume{" "}
              <span style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic" }}
                className="gradient-text">Comparison</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-2)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              {dateA} vs {dateB}
            </p>
          </div>
        </div>

        {/* ── Summary stat cards ── */}
        <div className="grid sm:grid-cols-3 gap-4">
          {atsA != null && atsB != null && (
            <StatCard
              label="ATS Score"
              valueA={atsA} valueB={atsB}
              delta={atsDelta}
              unit=""
            />
          )}
          <StatCard
            label="Skills Count"
            valueA={skillsA.size} valueB={skillsB.size}
            delta={skillDelta}
          />
          <StatCard
            label="Best Role Match"
            valueA={`${scoreA}%`} valueB={`${scoreB}%`}
            delta={roleDelta}
          />
        </div>

        {/* ── Role headers side by side ── */}
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { label: "Resume A", date: dateA, role: roleA, score: scoreA, name: analysisA.resumeName },
            { label: "Resume B", date: dateB, role: roleB, score: scoreB, name: analysisB.resumeName },
          ].map(({ label, date, role, score, name }, idx) => {
            const s = scoreBadgeStyle(score);
            return (
              <div key={idx} className="glass rounded-2xl p-5"
                style={{ border: idx === 1 ? "1.5px solid rgba(59,110,248,0.3)" : undefined }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: idx === 1 ? "#3b6ef8" : "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                    {label} {idx === 1 && "✨"}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                    {date}
                  </span>
                </div>
                <p className="text-xs mb-1" style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                  {name}
                </p>
                <p className="font-bold capitalize text-base"
                  style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                  {role}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <span style={{
                    fontSize: "1.5rem", fontWeight: 800, color: s.color,
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}>{score}%</span>
                  <span style={{
                    fontSize: "0.7rem", padding: "2px 8px", borderRadius: 999,
                    background: s.bg, border: `1px solid ${s.border}`, color: s.color,
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}>match</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Skills diff ── */}
        <div className="glass rounded-3xl p-6">
          <h2 className="font-bold text-base mb-5"
            style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            🧠 Skills Comparison
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">

            {/* Gained */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: "#10b981", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                ✅ Gained ({gained.length})
              </p>
              {gained.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                  No new skills
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {gained.map((s, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{
                        background: "rgba(16,185,129,0.1)",
                        border: "1px solid rgba(16,185,129,0.25)",
                        color: "#10b981",
                        fontFamily: "Plus Jakarta Sans, sans-serif",
                      }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Common */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: "#3b6ef8", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                🔵 Retained ({common.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {common.slice(0, 12).map((s, i) => (
                  <span key={i} className="skill-pill">{s}</span>
                ))}
                {common.length > 12 && (
                  <span className="skill-pill">+{common.length - 12}</span>
                )}
              </div>
            </div>

            {/* Lost */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: "#ef4444", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                ❌ Removed ({lost.length})
              </p>
              {lost.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                  No removed skills
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {lost.map((s, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        color: "#ef4444",
                        fontFamily: "Plus Jakarta Sans, sans-serif",
                      }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Role match comparison bars ── */}
        {sharedRoles.length > 0 && (
          <div className="glass rounded-3xl p-6">
            <h2 className="font-bold text-base mb-5"
              style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              🎯 Role Match — Before vs After
            </h2>
            <div className="space-y-5">
              {sharedRoles.map(({ role, scoreA: sA, scoreB: sB, emoji }) => (
                <div key={role}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize"
                      style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                      {emoji} {role}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: "var(--text-3)" }}>{sA}%</span>
                      <span style={{ color: "var(--text-3)", fontSize: "0.7rem" }}>→</span>
                      <span className="text-sm font-bold" style={{ color: sB >= sA ? "#10b981" : "#ef4444" }}>
                        {sB}%
                      </span>
                      <DeltaBadge delta={sB - sA} />
                    </div>
                  </div>
                  {/* Stacked bars */}
                  <div style={{ position: "relative", height: 10, borderRadius: 999, background: "rgba(180,190,220,0.15)", overflow: "hidden" }}>
                    {/* A bar (faint) */}
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${sA}%`, borderRadius: 999,
                      background: "rgba(180,190,220,0.5)",
                      transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
                    }} />
                    {/* B bar */}
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${sB}%`, borderRadius: 999,
                      background: sB >= sA
                        ? "linear-gradient(90deg,#3b6ef8,#10b981)"
                        : "linear-gradient(90deg,#ef4444,#f59e0b)",
                      opacity: 0.85,
                      transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
                    }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs mt-4" style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Faint bar = Resume A · Colored bar = Resume B
            </p>
          </div>
        )}

        {/* ── CTA ── */}
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => onNavigate("analyze")}
            className="btn-primary px-6 py-3 rounded-xl text-sm">
            Analyze New Resume →
          </button>
          <button onClick={() => onNavigate("history")}
            className="px-6 py-3 rounded-xl text-sm font-medium"
            style={{
              background: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(180,190,220,0.4)",
              color: "var(--text)",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}>
            Back to History
          </button>
        </div>

      </div>
    </div>
  );
}
