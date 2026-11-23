import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, GitCompare, Minus } from "lucide-react";
import { Badge, Button, Card, EmptyState, Icon, PageHeader } from "../components/ui";
import { roleIcon, roleLabel } from "../constants/targetRoles";
import { formatSkill, longDate } from "../utils/format";

const score = (value) => {
  const number = parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
};

// Higher is better for every compared metric.
function Delta({ before, after, unit = "" }) {
  if (before == null || after == null) return <span className="text-ink-muted">–</span>;
  const change = after - before;
  if (change === 0) {
    return <span className="inline-flex items-center gap-1 text-ink-muted"><Icon icon={Minus} />No change</span>;
  }
  const up = change > 0;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${up ? "text-success" : "text-danger"}`}>
      <Icon icon={up ? ArrowUp : ArrowDown} />
      <span className="tabular">{up ? "+" : "−"}{Math.abs(change)}{unit}</span>
      <span className="sr-only">{up ? "increase" : "decrease"}</span>
    </span>
  );
}

function Row({ label, icon, before, after, unit, format = (value) => value }) {
  return (
    <tr className="border-b border-line last:border-0">
      <th scope="row" className="px-4 py-3 text-left font-medium text-ink">
        <span className="flex items-center gap-2">{icon && <Icon icon={icon} className="shrink-0 text-ink-muted" />}{label}</span>
      </th>
      <td className="tabular px-4 py-3 text-ink-secondary">{before == null ? "–" : `${format(before)}${unit || ""}`}</td>
      <td className="bg-page px-4 py-3"><Delta before={before} after={after} unit={unit} /></td>
      <td className="tabular px-4 py-3 font-medium text-ink">{after == null ? "–" : `${format(after)}${unit || ""}`}</td>
    </tr>
  );
}

function SkillList({ title, skills, tone }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{title} <span className="tabular font-normal text-ink-muted">{skills.length}</span></h3>
      {skills.length ? (
        <ul aria-label={title} className="mt-2 flex flex-wrap gap-1.5">
          {skills.map((skill) => <li key={skill}><Badge tone={tone}>{formatSkill(skill)}</Badge></li>)}
        </ul>
      ) : <p className="mt-2 text-sm text-ink-muted">None</p>}
    </div>
  );
}

export default function Compare({ analysisA, analysisB, onNavigate }) {
  const [showAllRoles, setShowAllRoles] = useState(false);
  // Always older → newer, whatever order the two were picked in.
  const [older, newer] = useMemo(() => {
    if (!analysisA || !analysisB) return [null, null];
    return [analysisA, analysisB].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [analysisA, analysisB]);

  const roles = useMemo(() => {
    if (!older || !newer) return [];
    const names = [...new Set([...Object.keys(older.match || {}), ...Object.keys(newer.match || {})])];
    return names
      .map((role) => ({ role, before: score(older.match?.[role]?.score), after: score(newer.match?.[role]?.score) }))
      .sort((a, b) => Math.max(b.before ?? 0, b.after ?? 0) - Math.max(a.before ?? 0, a.after ?? 0));
  }, [older, newer]);

  if (!older || !newer) {
    return (
      <>
        <PageHeader title="Compare analyses" />
        <Card>
          <EmptyState icon={GitCompare} title="Pick two analyses to compare" description="Select two rows in History, then choose Compare selected."
            action={<Button variant="primary" onClick={() => onNavigate("history")}>Go to history</Button>} />
        </Card>
      </>
    );
  }

  const skillsBefore = new Set(older.skills || []);
  const skillsAfter = new Set(newer.skills || []);
  const gained = [...skillsAfter].filter((skill) => !skillsBefore.has(skill));
  const kept = [...skillsAfter].filter((skill) => skillsBefore.has(skill));
  const removed = [...skillsBefore].filter((skill) => !skillsAfter.has(skill));
  const visibleRoles = showAllRoles ? roles : roles.slice(0, 6);
  const column = (analysis, label) => (
    <th scope="col" className="px-4 py-3 text-left align-bottom">
      <span className="block text-xs font-medium uppercase tracking-[0.02em] text-ink-muted">{label}</span>
      <span className="mt-1 block max-w-[220px] truncate text-sm font-medium normal-case tracking-normal text-ink" title={analysis.resumeName}>{analysis.resumeName}</span>
      <span className="block text-sm font-normal normal-case tracking-normal text-ink-muted">{longDate(analysis.createdAt)}</span>
    </th>
  );

  return (
    <>
      <PageHeader
        title="Compare analyses"
        description={`How your resume changed from ${longDate(older.createdAt)} to ${longDate(newer.createdAt)}.`}
        actions={<Button icon={ArrowLeft} onClick={() => onNavigate("history")}>Back to history</Button>}
      />
      <div className="space-y-6">
        <Card padding="none">
          {/* relative: keeps sr-only (absolute) labels inside the scroll area instead of widening the page. */}
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm" aria-label="Comparison">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-4 py-3 text-left align-bottom text-xs font-medium uppercase tracking-[0.02em] text-ink-muted">Metric</th>
                  {column(older, "Older")}
                  <th scope="col" className="bg-page px-4 py-3 text-left align-bottom text-xs font-medium uppercase tracking-[0.02em] text-ink-muted">Change</th>
                  {column(newer, "Newer")}
                </tr>
              </thead>
              <tbody>
                <Row label="ATS score" before={older.atsScore ?? null} after={newer.atsScore ?? null} />
                <Row label="Skills found" before={older.skills?.length ?? 0} after={newer.skills?.length ?? 0} />
                <Row label="Best role match" before={older.bestRole?.score ?? null} after={newer.bestRole?.score ?? null} unit="%" />
                <tr className="border-b border-line">
                  <th scope="rowgroup" colSpan={4} className="bg-page px-4 py-2 text-left text-xs font-medium uppercase tracking-[0.02em] text-ink-muted">Role match</th>
                </tr>
                {visibleRoles.map(({ role, before, after }) => (
                  <Row key={role} label={roleLabel(role)} icon={roleIcon(role)} before={before} after={after} unit="%" />
                ))}
              </tbody>
            </table>
          </div>
          {roles.length > 6 && (
            <div className="border-t border-line px-4 py-2.5">
              <Button variant="ghost" size="sm" aria-expanded={showAllRoles} onClick={() => setShowAllRoles((value) => !value)}>
                {showAllRoles ? "Show top 6 roles" : `Show all ${roles.length} roles`}
              </Button>
            </div>
          )}
        </Card>

        <Card as="section" title="Skills">
          <div className="grid gap-5 md:grid-cols-3">
            <SkillList title="Gained" skills={gained} tone="success" />
            <SkillList title="Kept" skills={kept} tone="neutral" />
            <SkillList title="Removed" skills={removed} tone="danger" />
          </div>
        </Card>
      </div>
    </>
  );
}
