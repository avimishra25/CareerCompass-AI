import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const AppDataContext = createContext(null);

// Loads GET /api/history once and shares it (Dashboard, ProgressTracker, Career Coach).
function useHistoryLoader(enabled) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(enabled);
  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    return Promise.resolve()
      .then(() => axios.get(`${API}/api/history`, auth()))
      .then((response) => setHistory(Array.isArray(response?.data) ? response.data : []))
      .catch(() => setError("Could not load your analyses."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (enabled) reload(); }, [enabled, reload]);
  return { history, error, loading, reload };
}

export function AppDataProvider({ children }) {
  const historyState = useHistoryLoader(true);
  // Results just produced on the Analyze page; the coach prefers them over the saved latest analysis.
  const [coachAnalysis, setCoachAnalysis] = useState(null);
  const value = useMemo(() => ({ ...historyState, coachAnalysis, setCoachAnalysis }), [historyState, coachAnalysis]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

const NO_PROVIDER = { coachAnalysis: null, setCoachAnalysis: () => {} };

// For components that only publish data (e.g. fresh analysis results); never fetches.
export const useOptionalAppData = () => useContext(AppDataContext);

// Shared data when inside the provider; otherwise the component loads history itself.
export function useAppData() {
  const shared = useContext(AppDataContext);
  const local = useHistoryLoader(!shared);
  return shared || { ...local, ...NO_PROVIDER };
}

// The analysis the Career Coach talks about: fresh results if any, else the latest saved one.
export function coachContextFrom(analysis) {
  if (!analysis) return null;
  return {
    skills: analysis.skills || [],
    atsScore: analysis.atsScore ?? null,
    atsBreakdown: analysis.atsBreakdown || {},
    bestRole: analysis.bestRole || null,
    matchData: analysis.match || analysis.matchData || {},
    targetRole: analysis.targetRole || "",
    mlInsights: analysis.mlInsights || null,
  };
}
