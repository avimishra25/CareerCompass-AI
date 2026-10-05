import React, { useEffect, useState } from "react";
import axios from "axios";
import { Gauge } from "../components/ATSReport";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const errorMessage = (error, fallback) => error.response?.data?.error || error.response?.data?.message || fallback;

export default function JDMatch({ onNavigate }) {
  const [analyses, setAnalyses] = useState([]);
  const [history, setHistory] = useState([]);
  const [analysisId, setAnalysisId] = useState("");
  const [jdText, setJdText] = useState("");
  const [jdTitle, setJdTitle] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([axios.get(`${API}/api/history`, auth()), axios.get(`${API}/api/jd-match/history`, auth())])
      .then(([resumes, matches]) => {
        if (!active) return;
        setAnalyses(resumes.data);
        setAnalysisId(resumes.data[0]?._id || "");
        setHistory(matches.data);
      })
      .catch((err) => { if (active) setError(errorMessage(err, "Could not load JD matching.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSelected(null);
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/api/jd-match`, { analysisId, jd_text: jdText, jdTitle }, auth());
      setSelected(data);
      setHistory((items) => [data, ...items]);
    } catch (err) {
      setError(errorMessage(err, "JD matching unavailable. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    setBusy(true);
    setError("");
    try {
      await axios.delete(`${API}/api/jd-match/${id}`, auth());
      setHistory((items) => items.filter((item) => item._id !== id));
      if (selected?._id === id) setSelected(null);
    } catch (err) {
      setError(errorMessage(err, "Could not delete JD match."));
    } finally {
      setBusy(false);
    }
  };

  const result = selected?.result;
  const length = [...jdText].length;
  return (
    <main className="px-6 py-10 max-w-5xl mx-auto space-y-6" style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <h1 className="text-2xl font-extrabold">JD Match</h1>
      <p className="text-sm">Compare a saved resume with a job description. Older analyses may require a fresh upload.</p>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {loading ? <p role="status">Loading analyses and matches…</p> : <>
        {!analyses.length ? <button className="btn-primary px-5 py-3 rounded-xl" onClick={() => onNavigate("analyze")}>Upload a resume first</button> : (
          <form onSubmit={submit} className="glass rounded-2xl p-6 space-y-4">
            <label className="block text-sm">Past analysis
              <select className="block w-full border rounded-xl p-3 mt-2" value={analysisId} onChange={(event) => setAnalysisId(event.target.value)} disabled={busy} required>
                {analyses.map((item) => <option key={item._id} value={item._id}>{item.resumeName} — {new Date(item.createdAt).toLocaleString()}</option>)}
              </select>
            </label>
            <label className="block text-sm">JD title (optional)
              <input className="block w-full border rounded-xl p-3 mt-2" value={jdTitle} onChange={(event) => setJdTitle(event.target.value)} maxLength={120} disabled={busy} />
            </label>
            <label className="block text-sm">Job description
              <textarea className="block w-full border rounded-xl p-3 mt-2" rows={9} value={jdText} onChange={(event) => setJdText(event.target.value)} disabled={busy} required aria-describedby="jd-length" />
            </label>
            <p id="jd-length" className={length > 8000 ? "text-red-600 text-xs" : "text-xs"}>{length} / 8000 characters</p>
            <button className="btn-primary px-6 py-3 rounded-xl disabled:opacity-50" disabled={busy || !analysisId || !jdText.trim() || length > 8000}>{busy ? "Working…" : "Match JD"}</button>
          </form>
        )}
        {result && <section className="glass rounded-2xl p-6 space-y-5" aria-label="Match result">
          <div className="flex items-center gap-6"><Gauge score={result.overall_match} /><div>
            <h2 className="font-bold text-xl">{selected.jdTitle}</h2><p className="font-semibold">{result.verdict} match</p>
            <p className="text-xs mt-2">40% text similarity + 60% JD skill coverage. No detected JD skills means zero skill coverage.</p>
          </div></div>
          {[["Matched skills", "matched_skills"], ["Missing skills", "missing_skills"], ["Extra skills", "extra_skills"], ["Keyword gaps", "keyword_gaps"]].map(([label, key]) => (
            <div key={key}><h3 className="font-semibold mb-2">{label}</h3><div className="flex flex-wrap gap-2">
              {result[key].length ? result[key].map((skill) => <span className="skill-pill" key={skill}>{skill}</span>) : <span className="text-sm">None detected</span>}
            </div></div>
          ))}
          <p className="text-xs">Skills reflect text mentions, not proven ability. Missing skills appear by JD frequency; keyword gaps by TF-IDF weight.</p>
        </section>}
        <section className="glass rounded-2xl p-6 space-y-4" aria-label="JD match history">
          <h2 className="text-xl font-bold">Match history</h2>
          {!history.length && <p className="text-sm">No matches yet.</p>}
          {history.map((item) => <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <button className="text-left" disabled={busy} onClick={() => setSelected(item)}>
              <span className="font-semibold">{item.jdTitle}</span> — {item.result.overall_match}/100 · {item.result.verdict}
              <span className="block text-xs">{new Date(item.createdAt).toLocaleString()}</span>
            </button>
            <button className="text-sm text-red-600" disabled={busy} onClick={() => remove(item._id)} aria-label={`Delete ${item.jdTitle}`}>Delete</button>
          </div>)}
        </section>
      </>}
    </main>
  );
}
