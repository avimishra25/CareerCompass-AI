import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FileSearch, GitCompare, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Icon, InlineAlert, LoadingState, PageHeader, cx, scoreTone } from "../components/ui";
import { roleIcon, roleLabel } from "../constants/targetRoles";
import { longDate } from "../utils/format";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const ATS_TONE = { warning: "warning", brand: "brand", success: "success" };

function DeleteCell({ entry, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Delete ${entry.resumeName}`} onClick={() => setConfirming(true)}
        className="text-ink-muted hover:text-danger" />
    );
  }
  return (
    <span className="flex items-center justify-end gap-1.5">
      <Button variant="danger" size="sm" loading={busy} aria-label={`Confirm delete ${entry.resumeName}`}
        onClick={async () => { setBusy(true); if (!(await onDelete(entry._id))) { setBusy(false); setConfirming(false); } }}>
        Delete
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
    </span>
  );
}

export default function History({ onNavigate }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [selected, setSelected] = useState([]); // up to 2 analysis IDs, in click order

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    axios.get(`${API}/api/history`, auth())
      .then(({ data }) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setError("Could not load your history."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Returns true when deleted, so the row can reset its confirm state on failure.
  const remove = async (id) => {
    setDeleteError("");
    try {
      await axios.delete(`${API}/api/history/${id}`, auth());
      setHistory((items) => items.filter((item) => item._id !== id));
      setSelected((ids) => ids.filter((item) => item !== id));
      return true;
    } catch {
      setDeleteError("Could not delete the analysis. Try again.");
      return false;
    }
  };

  // Two at most: picking a third replaces the oldest pick.
  const toggle = (id) => setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id].slice(-2)));
  const compare = () => {
    const [analysisA, analysisB] = selected.map((id) => history.find((item) => item._id === id));
    onNavigate("compare", { analysisA, analysisB });
  };

  return (
    <>
      <PageHeader
        title="History"
        description="Every analysis you have run. Select two to compare them."
        actions={history.length >= 2 && (
          <Button variant="primary" icon={GitCompare} onClick={compare} disabled={selected.length !== 2}>Compare selected</Button>
        )}
      />
      {deleteError && <InlineAlert className="mb-4" onDismiss={() => setDeleteError("")}>{deleteError}</InlineAlert>}

      {loading ? <LoadingState label="Loading your history" /> : error ? (
        <InlineAlert title={error} action={<Button size="sm" onClick={load}>Try again</Button>}>Check your connection, then try again.</InlineAlert>
      ) : !history.length ? (
        <Card>
          <EmptyState icon={FileSearch} title="No analyses yet" description="Analyze a resume and it will be saved here."
            action={<Button variant="primary" onClick={() => onNavigate("analyze")}>Analyze resume</Button>} />
        </Card>
      ) : (
        <Card padding="none">
          {selected.length > 0 && (
            <p role="status" className="border-b border-line px-4 py-2.5 text-sm text-ink-secondary">
              {selected.length === 1 ? "1 selected. Select one more to compare." : "2 selected."}{" "}
              <button type="button" onClick={() => setSelected([])} className="rounded-control font-medium text-brand hover:underline">Clear</button>
            </p>
          )}
          {/* Scrolls inside the card on narrow screens instead of squeezing columns. */}
          {/* relative: keeps sr-only (absolute) labels inside the scroll area instead of widening the page. */}
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm" aria-label="Analyses">
              <thead>
                <tr className="border-b border-line text-xs font-medium uppercase tracking-[0.02em] text-ink-muted">
                  <th scope="col" className="w-12 px-4 py-2.5"><span className="sr-only">Select</span></th>
                  <th scope="col" className="px-2 py-2.5">File</th>
                  <th scope="col" className="px-2 py-2.5">Target role</th>
                  <th scope="col" className="px-2 py-2.5">ATS</th>
                  <th scope="col" className="px-2 py-2.5">Top role</th>
                  <th scope="col" className="px-2 py-2.5">Date</th>
                  <th scope="col" className="px-4 py-2.5 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const isSelected = selected.includes(entry._id);
                  const top = entry.bestRole?.role;
                  return (
                    <tr key={entry._id} className={cx("border-b border-line last:border-0", isSelected && "bg-brand-tint")}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggle(entry._id)}
                          aria-label={`Select ${entry.resumeName} from ${longDate(entry.createdAt)}`}
                          className="h-4 w-4 rounded border-line-strong accent-brand" />
                      </td>
                      <td className="max-w-[240px] px-2 py-3">
                        <span className="block truncate font-medium text-ink" title={entry.resumeName}>{entry.resumeName}</span>
                        <span className="text-ink-muted">{entry.skills?.length || 0} skills</span>
                      </td>
                      <td className="px-2 py-3 text-ink-secondary">{entry.targetRole ? roleLabel(entry.targetRole) : <span className="text-ink-muted">Auto</span>}</td>
                      <td className="px-2 py-3">
                        {entry.atsScore != null ? <Badge tone={ATS_TONE[scoreTone(entry.atsScore)]}><span className="tabular">{entry.atsScore}</span></Badge> : "–"}
                      </td>
                      <td className="px-2 py-3">
                        {top ? (
                          <span className="flex items-center gap-2 text-ink-secondary">
                            <Icon icon={roleIcon(top)} className="shrink-0 text-ink-muted" />
                            {roleLabel(top)} <span className="tabular text-ink-muted">{entry.bestRole.score}%</span>
                          </span>
                        ) : "–"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-ink-secondary">{longDate(entry.createdAt)}</td>
                      <td className="px-4 py-3 text-right"><DeleteCell entry={entry} onDelete={remove} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
