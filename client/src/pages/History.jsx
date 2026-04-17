import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from '../api';

export default function History({ onNavigate }) {
  const [history,   setHistory]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [selected,  setSelected]  = useState([]);   // ← IDs of checked analyses

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("http://localhost:5000/api/history", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setHistory(Array.isArray(res.data) ? res.data : []);
      } catch { setError("Failed to load history."); }
      finally   { setLoading(false); }
    })();
  }, []);

  const deleteEntry = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/api/history/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory(p => p.filter(h => h._id !== id));
      setSelected(p => p.filter(s => s !== id));
    } catch { alert("Failed to delete."); }
  };

  // ── Toggle checkbox selection ──
  const toggleSelect = (id) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 2)  return [prev[1], id];   // max 2, slide window
      return [...prev, id];
    });
  };

  const canCompare = selected.length === 2;

  const handleCompare = () => {
    if (!canCompare) return;
    const [a, b] = selected.map(id => history.find(h => h._id === id));
    onNavigate("compare", { analysisA: a, analysisB: b });
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-5xl mx-auto">

        {/* ── Header ── */}
        <div className="mb-8 fade-up flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1"
              style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Analysis{" "}
              <span style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic" }}
                className="gradient-text">History</span>
            </h1>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              Your past resume analyses, stored securely.
              {history.length >= 2 && (
                <span style={{ color: "var(--text-3)" }}>
                  {" "}· Select 2 to compare
                </span>
              )}
            </p>
          </div>

          {/* ── Compare button — appears when 2 selected ── */}
          <button
            onClick={handleCompare}
            disabled={!canCompare}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background:   canCompare ? "linear-gradient(135deg,#3b6ef8,#6c63ff)" : "rgba(180,190,220,0.15)",
              color:        canCompare ? "#fff"                                      : "var(--text-3)",
              border:       canCompare ? "none"                                      : "1px solid rgba(180,190,220,0.3)",
              cursor:       canCompare ? "pointer"                                   : "not-allowed",
              fontFamily:   "Plus Jakarta Sans, sans-serif",
              opacity:      canCompare ? 1 : 0.6,
              transition:   "all 0.25s",
              boxShadow:    canCompare ? "0 4px 14px rgba(59,110,248,0.3)" : "none",
            }}>
            🔀 Compare {canCompare ? "Selected" : "(select 2)"}
          </button>
        </div>

        {/* ── Selection hint bar ── */}
        {selected.length > 0 && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center justify-between"
            style={{
              background: "rgba(59,110,248,0.06)",
              border: "1px solid rgba(59,110,248,0.18)",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}>
            <span style={{ color: "#3b6ef8" }}>
              {selected.length === 1
                ? "1 selected — pick one more to compare"
                : "2 selected — ready to compare!"}
            </span>
            <button
              onClick={() => setSelected([])}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: "var(--text-3)", background: "rgba(180,190,220,0.2)" }}>
              Clear
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-24">
            <svg className="animate-spin h-8 w-8" style={{ color: "#3b6ef8" }} viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        )}

        {error && (
          <div className="glass rounded-2xl p-6 text-center text-sm"
            style={{ color: "#e11d6a" }}>{error}</div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="glass rounded-3xl p-16 text-center fade-up">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="font-bold text-lg mb-1"
              style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              No analyses yet
            </h3>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              Upload your first resume to get started.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {history.map((entry, i) => {
            const isSelected = selected.includes(entry._id);
            return (
              <div key={entry._id}
                className="glass rounded-2xl p-6 fade-up transition-all duration-200"
                style={{
                  animationDelay: `${i * 0.06}s`,
                  opacity: 0,
                  border: isSelected
                    ? "1.5px solid rgba(59,110,248,0.45)"
                    : "1.5px solid transparent",
                  background: isSelected ? "rgba(59,110,248,0.03)" : undefined,
                }}>

                <div className="flex items-start justify-between gap-4 mb-4">

                  {/* ── Checkbox ── */}
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleSelect(entry._id)}
                      title={isSelected ? "Deselect" : "Select for comparison"}
                      className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: isSelected ? "#3b6ef8" : "rgba(180,190,220,0.6)",
                        background:  isSelected ? "#3b6ef8" : "rgba(255,255,255,0.5)",
                      }}>
                      {isSelected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className="font-bold text-sm capitalize"
                          style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                          {entry.bestRole?.role || "Unknown Role"}
                        </span>
                        {entry.bestRole?.score >= 0 && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold skill-pill">
                            {entry.bestRole.score}% match
                          </span>
                        )}
                        {entry.atsScore != null && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                            style={{
                              background: "rgba(16,185,129,0.1)",
                              color: "#10b981",
                              border: "1px solid rgba(16,185,129,0.2)",
                            }}>
                            ATS {entry.atsScore}
                          </span>
                        )}
                        {entry.targetRole && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                            style={{
                              background: "rgba(59,110,248,0.08)",
                              color: "#3b6ef8",
                              border: "1px solid rgba(59,110,248,0.2)",
                            }}>
                            🎯 {entry.targetRole}
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-3)" }}>
                        {entry.resumeName} · {new Date(entry.createdAt).toLocaleDateString("en-US", {
                          day: "numeric", month: "short", year: "numeric"
                        })}
                      </p>
                    </div>
                  </div>

                  <button onClick={() => deleteEntry(entry._id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition flex-shrink-0"
                    style={{
                      color: "#e11d6a",
                      background: "rgba(244,63,126,0.06)",
                      border: "1px solid rgba(244,63,126,0.15)",
                    }}>
                    Delete
                  </button>
                </div>

                {entry.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {entry.skills.slice(0, 10).map((s, j) => (
                      <span key={j} className="skill-pill">{s}</span>
                    ))}
                    {entry.skills.length > 10 && (
                      <span className="skill-pill">+{entry.skills.length - 10}</span>
                    )}
                  </div>
                )}

                {entry.match && Object.keys(entry.match).length > 0 && (
                  <div className="grid sm:grid-cols-3 gap-3">
                    {Object.entries(entry.match)
                      .sort((a, b) => parseInt(b[1].score) - parseInt(a[1].score))
                      .slice(0, 3)
                      .map(([role, data]) => (
                        <div key={role}>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs capitalize" style={{ color: "var(--text-2)" }}>{role}</span>
                            <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{data.score}%</span>
                          </div>
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${data.score}%` }} />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
