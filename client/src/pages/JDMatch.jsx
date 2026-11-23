import React, { useEffect, useState } from "react";
import axios from "axios";
import { FileSearch, Map, MessagesSquare, Target, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, InlineAlert, Input, LoadingState, PageHeader, ScoreRing, Select, Textarea, charCount, cx } from "../components/ui";
import { formatSkill, longDate } from "../utils/format";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const errorMessage = (error, fallback) => error.response?.data?.error || error.response?.data?.message || fallback;
const MAX_JD = 8000;
const VERDICT_TONE = { Strong: "success", Fair: "warning", Weak: "danger" };
const GROUPS = [
  ["Matched skills", "matched_skills", "success", true],
  ["Missing skills", "missing_skills", "danger", true],
  ["Extra skills", "extra_skills", "neutral", true],
  ["Keyword gaps", "keyword_gaps", "neutral", false],
];

function HistoryRow({ item, active, busy, onOpen, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const { overall_match: score, verdict } = item.result;
  return (
    <li className={cx("flex flex-wrap items-center gap-3 px-4 py-3", active && "bg-brand-tint")}>
      <button type="button" onClick={onOpen} disabled={busy} aria-label={`Open ${item.jdTitle}, ${score}/100, ${verdict}`}
        className="min-w-0 flex-1 basis-48 rounded-control text-left">
        <span className="block truncate text-sm font-medium text-ink">{item.jdTitle}</span>
        <span className="block text-sm text-ink-muted">{longDate(item.createdAt)}</span>
      </button>
      <span className="tabular text-sm font-medium text-ink">{score}/100</span>
      <Badge tone={VERDICT_TONE[verdict] || "neutral"}>{verdict}</Badge>
      {confirming ? (
        <span className="flex gap-1.5">
          <Button variant="danger" size="sm" disabled={busy} aria-label={`Confirm delete ${item.jdTitle}`} onClick={onDelete}>Delete</Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
        </span>
      ) : (
        <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Delete ${item.jdTitle}`} disabled={busy}
          className="text-ink-muted hover:text-danger" onClick={() => setConfirming(true)} />
      )}
    </li>
  );
}

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
      setError(errorMessage(err, "JD matching is unavailable. Try again."));
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
      setError(errorMessage(err, "Could not delete the JD match."));
    } finally {
      setBusy(false);
    }
  };

  const result = selected?.result;
  const length = charCount(jdText);
  const canSubmit = !busy && analysisId && jdText.trim() && length <= MAX_JD;

  return (
    <>
      <PageHeader title="JD match" description="Compare a saved resume with a job description to see which skills match and which are missing." />
      {error && <InlineAlert className="mb-4" onDismiss={() => setError("")}>{error}</InlineAlert>}

      {loading ? <LoadingState label="Loading analyses and matches" /> : (
        <div className="space-y-6">
          {!analyses.length ? (
            <Card>
              <EmptyState icon={FileSearch} title="Analyze a resume first" description="JD matching compares a saved analysis with a job description."
                action={<Button variant="primary" onClick={() => onNavigate("analyze")}>Analyze resume</Button>} />
            </Card>
          ) : (
            <Card as="form" onSubmit={submit} aria-label="Match a job description">
              <div className="grid gap-4 md:grid-cols-2">
                <Select label="Resume analysis" value={analysisId} onChange={(event) => setAnalysisId(event.target.value)} disabled={busy} required
                  hint="Older analyses may need a fresh upload."
                  options={analyses.map((item) => ({ value: item._id, label: `${item.resumeName} · ${longDate(item.createdAt)}` }))} />
                <Input label="Job title (optional)" value={jdTitle} onChange={(event) => setJdTitle(event.target.value)} maxLength={120} disabled={busy} />
              </div>
              <Textarea className="mt-4" label="Job description" rows={9} value={jdText} maxLength={MAX_JD} disabled={busy} required
                onChange={(event) => setJdText(event.target.value)} placeholder="Paste the full job description" />
              <Button type="submit" variant="primary" icon={Target} className="mt-4" disabled={!canSubmit} loading={busy}>
                Match job description
              </Button>
            </Card>
          )}

          {result && (
            <Card as="section" aria-label="Match result">
              <div className="flex flex-wrap items-center gap-4">
                <ScoreRing value={result.overall_match} label="JD match" size={72} />
                <div className="min-w-0 flex-1">
                  <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                    <span className="min-w-0 truncate">{selected.jdTitle}</span>
                    <Badge tone={VERDICT_TONE[result.verdict] || "neutral"}>{result.verdict}</Badge>
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">40% text similarity and 60% coverage of the skills the job mentions.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {GROUPS.map(([label, key, tone, isSkill]) => (
                  <div key={key}>
                    <h3 className="text-sm font-semibold text-ink">{label} <span className="tabular font-normal text-ink-muted">{result[key].length}</span></h3>
                    {result[key].length ? (
                      <ul aria-label={label} className="mt-2 flex flex-wrap gap-1.5">
                        {result[key].map((item) => <li key={item}><Badge tone={tone}>{isSkill ? formatSkill(item) : item}</Badge></li>)}
                      </ul>
                    ) : <p className="mt-2 text-sm text-ink-muted">None found</p>}
                  </div>
                ))}
              </div>
              <p className="mt-5 text-xs text-ink-muted">
                Skills reflect text mentions, not proven ability. Missing skills are ordered by how often the job mentions them; keyword gaps by TF-IDF weight.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4" role="group" aria-label="Next steps">
                {result.missing_skills.length > 0 && (
                  <Button icon={Map} onClick={() => onNavigate("roadmap", { analysisId: String(selected.analysisId), jdMatchId: selected._id })}>
                    Add these gaps to my roadmap
                  </Button>
                )}
                {/* Only the JD match is sent: the server uses its analysis, or your latest one if that was deleted. */}
                <Button icon={MessagesSquare} onClick={() => onNavigate("interview", { jdMatchId: selected._id, jdTitle: selected.jdTitle })}>
                  Practise interview for this job
                </Button>
              </div>
            </Card>
          )}

          <Card as="section" title="Match history">
            {history.length ? (
              <ul aria-label="JD match history" className="-mx-4 -mb-4 divide-y divide-line border-t border-line sm:-mx-5 sm:-mb-5">
                {history.map((item) => (
                  <HistoryRow key={item._id} item={item} active={selected?._id === item._id} busy={busy}
                    onOpen={() => setSelected(item)} onDelete={() => remove(item._id)} />
                ))}
              </ul>
            ) : <EmptyState icon={Target} className="py-8" title="No matches yet" description="Matches you run are saved here." />}
          </Card>
        </div>
      )}
    </>
  );
}
