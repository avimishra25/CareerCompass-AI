import React, { useEffect, useState } from "react";
import axios from "axios";
const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

// ── Custom tooltip ────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(240,242,247,0.95)",
      border: "1px solid rgba(180,190,220,0.4)",
      borderRadius: 12, padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
    }}>
      <p style={{
        fontSize: "0.72rem", fontWeight: 700,
        color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif",
        marginBottom: 6,
      }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{
          fontSize: "0.8rem", fontWeight: 600,
          color: p.color, fontFamily: "Plus Jakarta Sans, sans-serif",
          marginBottom: 2,
        }}>
          {p.name}: <span style={{ fontWeight: 800 }}>{p.value}{p.name === "ATS Score" ? "" : ""}</span>
        </p>
      ))}
    </div>
  );
}

export default function ProgressTracker() {
  const [chartData, setChartData] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API}/api/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const analyses = Array.isArray(res.data) ? res.data : [];

        if (analyses.length < 2) {
          setChartData(analyses.map((a, i) => formatPoint(a, i)));
          setLoading(false);
          return;
        }

        // Sort oldest → newest for chart left-to-right
        const sorted = [...analyses].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        setChartData(sorted.map((a, i) => formatPoint(a, i)));
      } catch {
        setError("Failed to load progress data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function formatPoint(a, i) {
    return {
      label:      new Date(a.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      "ATS Score":  a.atsScore ?? null,
      "Skills":     a.skills?.length ?? 0,
      "Role Match": a.bestRole?.score ?? null,
      role:         a.bestRole?.role || "",
      index:        i + 1,
    };
  }

  if (loading) return (
    <div className="glass rounded-3xl p-8 flex items-center justify-center" style={{ minHeight: 200 }}>
      <svg className="animate-spin h-6 w-6" style={{ color: "#3b6ef8" }} viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );

  if (error) return null;

  if (chartData.length === 0) return null;

  if (chartData.length === 1) return (
    <div className="glass rounded-3xl p-6">
      <h2 className="font-bold text-base mb-2"
        style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
        📈 Progress Tracker
      </h2>
      <p className="text-sm" style={{ color: "var(--text-2)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
        Upload another resume to start tracking your progress over time.
      </p>
    </div>
  );

  // Summary stats
  const latest   = chartData[chartData.length - 1];
  const earliest = chartData[0];
  const atsDelta = (latest["ATS Score"] != null && earliest["ATS Score"] != null)
    ? latest["ATS Score"] - earliest["ATS Score"]
    : null;
  const skillDelta = latest["Skills"] - earliest["Skills"];

  return (
    <div className="glass rounded-3xl p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Growth Over Time
          </p>
          <h2 className="text-xl font-bold"
            style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            📈 Progress Tracker
          </h2>
        </div>
        <div className="flex gap-3">
          {atsDelta != null && (
            <div className="text-center px-4 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(180,190,220,0.3)" }}>
              <p style={{
                fontSize: "1.1rem", fontWeight: 800,
                color: atsDelta >= 0 ? "#10b981" : "#ef4444",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}>
                {atsDelta >= 0 ? "+" : ""}{atsDelta}
              </p>
              <p style={{ fontSize: "0.65rem", color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                ATS pts
              </p>
            </div>
          )}
          <div className="text-center px-4 py-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(180,190,220,0.3)" }}>
            <p style={{
              fontSize: "1.1rem", fontWeight: 800,
              color: skillDelta >= 0 ? "#10b981" : "#ef4444",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}>
              {skillDelta >= 0 ? "+" : ""}{skillDelta}
            </p>
            <p style={{ fontSize: "0.65rem", color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              skills
            </p>
          </div>
        </div>
      </div>

      {/* ATS Score chart */}
      {chartData.some(d => d["ATS Score"] != null) && (
        <div>
          <p className="text-xs font-semibold mb-3"
            style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            ATS Score & Role Match %
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(180,190,220,0.2)" />
              <XAxis dataKey="label"
                tick={{ fontSize: 11, fill: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "0.72rem", fontFamily: "Plus Jakarta Sans, sans-serif", paddingTop: 8 }} />
              <ReferenceLine y={75} stroke="rgba(16,185,129,0.3)" strokeDasharray="4 4"
                label={{ value: "Strong", position: "right", fontSize: 10, fill: "#10b981" }} />
              <Line type="monotone" dataKey="ATS Score"
                stroke="#3b6ef8" strokeWidth={2.5}
                dot={{ r: 4, fill: "#3b6ef8", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6 }}
                connectNulls />
              <Line type="monotone" dataKey="Role Match"
                stroke="#6c63ff" strokeWidth={2} strokeDasharray="5 3"
                dot={{ r: 3, fill: "#6c63ff", strokeWidth: 2, stroke: "#fff" }}
                connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Skills count chart */}
      <div>
        <p className="text-xs font-semibold mb-3"
          style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Skills Extracted per Upload
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(180,190,220,0.2)" />
            <XAxis dataKey="label"
              tick={{ fontSize: 11, fill: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="Skills"
              stroke="#10b981" strokeWidth={2.5}
              dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs" style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
        Based on {chartData.length} uploads · Oldest → newest (left → right)
      </p>
    </div>
  );
}
