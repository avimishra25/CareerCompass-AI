import React, { useId, useState } from "react";
import { ArrowRight, CircleCheck, FilePen, Lightbulb, Map, MessagesSquare } from "lucide-react";
import { Badge, Button, Card, Icon, ProgressBar, ScoreRing, TabPanel, Tabs, scoreTone } from "../ui";
import { roleIcon, roleLabel } from "../../constants/targetRoles";
import { formatSkill, longDate } from "../../utils/format";
import { groupSkills } from "../../utils/skillGroups";
import { improvementTips, nextStep } from "./nextStep";

const VERDICT = { warning: ["Needs work", "warning"], brand: ["Good", "brand"], success: ["Strong", "success"] };
const MAX_PER_GROUP = 12;
const percent = (value) => {
  const number = parseInt(value, 10);
  return Number.isFinite(number) ? number : 0;
};

export function NextStepCard({ step, onAction, secondary }) {
  const icon = { resume: FilePen, roadmap: Map, interview: MessagesSquare }[step.kind];
  return (
    <Card as="section" aria-labelledby="next-step-title" className="border-brand/40" data-html2canvas-ignore="true">
      <div className="flex flex-wrap items-start gap-4">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-tint text-brand">
          <Icon icon={icon} size={20} />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-sm font-medium text-brand">Your next step</p>
          <h2 id="next-step-title" className="mt-0.5 text-base font-semibold text-ink">{step.title}</h2>
          <p className="mt-1 text-sm text-ink-secondary">{step.text}</p>
        </div>
        <div role="group" aria-label="Next steps" className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button variant="primary" iconRight={ArrowRight} onClick={() => onAction(step.kind)}>{step.action}</Button>
          {secondary.map(({ kind, label }) => <Button key={kind} onClick={() => onAction(kind)}>{label}</Button>)}
        </div>
      </div>
    </Card>
  );
}

function SummaryStat({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 min-w-0">{children}</dd>
    </div>
  );
}

export function SummaryRow({ atsScore, role, roleScore, skillCount, fileName, analysedAt }) {
  const [verdict, tone] = VERDICT[scoreTone(atsScore)];
  return (
    <Card as="section" aria-label="Analysis summary">
      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat label="ATS score">
          <span className="flex items-center gap-3">
            <ScoreRing value={atsScore} label="ATS score" size={56} />
            <Badge tone={tone}>{verdict}</Badge>
          </span>
        </SummaryStat>
        <SummaryStat label={role ? `Match for ${roleLabel(role)}` : "Role match"}>
          <span className="tabular text-xl font-semibold text-ink">{roleScore != null ? `${roleScore}%` : "–"}</span>
        </SummaryStat>
        <SummaryStat label="Skills found">
          <span className="tabular text-xl font-semibold text-ink">{skillCount}</span>
        </SummaryStat>
        <SummaryStat label="Analysed file">
          <span className="block truncate text-sm font-medium text-ink" title={fileName}>{fileName}</span>
          <span className="block text-sm text-ink-muted">{longDate(analysedAt)}</span>
        </SummaryStat>
      </dl>
    </Card>
  );
}

const BREAKDOWN = [
  ["skills", "Skill coverage", 30, (item) => `${item?.score ?? 0} of 30 skill points`],
  ["verbs", "Action verbs", 20, (item) => (item?.found?.length ? `Found: ${item.found.join(", ")}` : "No action verbs found")],
  ["quantified", "Quantified results", 20, () => "Numbers, percentages, team sizes and money"],
  ["sections", "Resume sections", 20, () => "Summary, experience, projects, skills and education"],
  ["length", "Length", 10, (item) => `${item?.words ?? 0} words; 400–700 is ideal`],
];

function OverviewPanel({ atsBreakdown = {}, mlInsights }) {
  const drivers = mlInsights?.top_drivers || [];
  const tips = improvementTips(mlInsights, atsBreakdown);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold text-ink">Score breakdown</h3>
        <ul className="mt-3 space-y-4">
          {BREAKDOWN.map(([key, label, max, detail]) => {
            const score = atsBreakdown[key]?.score ?? 0;
            return (
              <li key={key}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-ink-secondary">{label}</span>
                  <span className="tabular font-medium text-ink">{score}/{max}</span>
                </div>
                <ProgressBar value={score} max={max} label={label} tone={scoreTone(score, max)} className="mt-1.5" />
                <p className="mt-1 text-xs text-ink-muted">{detail(atsBreakdown[key])}</p>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="space-y-6">
        {drivers.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-ink">What's working</h3>
            <ul className="mt-3 space-y-2">
              {drivers.map((driver) => (
                <li key={driver.feature} className="flex items-center gap-2 text-sm text-ink-secondary">
                  <Icon icon={CircleCheck} className="shrink-0 text-success" />
                  <span className="flex-1">{driver.label}</span>
                  <span className="tabular text-ink-muted">{driver.your_value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {tips.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-ink">Improve here</h3>
            <ul className="mt-3 space-y-3">
              {tips.map((tip) => (
                <li key={tip.label} className="flex gap-2">
                  <Icon icon={Lightbulb} className="mt-0.5 shrink-0 text-warning" />
                  <span>
                    <span className="block text-sm font-medium text-ink">{tip.label}</span>
                    <span className="block text-sm text-ink-secondary">{tip.tip}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-ink-muted">
          The score comes from a model trained on synthetic resumes. Use it as guidance, not as a prediction of any employer's ATS.
        </p>
      </div>
    </div>
  );
}

function SkillGroup({ group, items }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, MAX_PER_GROUP);
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{group} <span className="tabular font-normal text-ink-muted">{items.length}</span></h3>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {shown.map((skill) => <li key={skill}><Badge>{formatSkill(skill)}</Badge></li>)}
        {items.length > MAX_PER_GROUP && (
          <li>
            <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}
              className="rounded-control px-1.5 text-xs font-medium text-brand hover:underline">
              {expanded ? "Show fewer" : `+${items.length - MAX_PER_GROUP} more`}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function SkillsPanel({ skills }) {
  const groups = groupSkills(skills);
  if (!groups.length) return <p className="text-sm text-ink-muted">No skills were found in this resume.</p>;
  return <div className="grid gap-5 sm:grid-cols-2">{groups.map((group) => <SkillGroup key={group.group} {...group} />)}</div>;
}

function RoleRow({ role, score, missing, target }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const name = roleLabel(role);
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Icon icon={roleIcon(role)} size={20} className="shrink-0 text-ink-secondary" />
        <span className="min-w-0 flex-1 basis-40 text-sm font-medium text-ink">
          {name} {target && <Badge tone="brand" className="ml-1">Target</Badge>}
        </span>
        <ProgressBar value={score} label={`${name} match`} tone={scoreTone(score)} className="w-24 sm:w-40" />
        <span className="tabular w-10 text-right text-sm font-medium text-ink">{score}%</span>
        {missing.length ? (
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={listId}
            className="rounded-control">
            <Badge tone="danger">{missing.length} missing</Badge>
          </button>
        ) : <Badge tone="success">No gaps</Badge>}
      </div>
      {open && (
        <ul id={listId} aria-label={`Missing for ${name}`} className="mt-2 flex flex-wrap gap-1.5 pl-8">
          {missing.map((skill) => <li key={skill}><Badge>{formatSkill(skill)}</Badge></li>)}
        </ul>
      )}
    </li>
  );
}

function MatchPanel({ matchData = {}, targetRole }) {
  const [showAll, setShowAll] = useState(false);
  const rows = Object.entries(matchData)
    .map(([role, data]) => ({ role, score: percent(data?.score), missing: Array.isArray(data?.missing) ? data.missing : [] }))
    .sort((a, b) => b.score - a.score);
  const target = rows.find((row) => row.role === targetRole);
  const others = rows.filter((row) => row !== target);
  const visible = showAll ? others : others.slice(0, 3);
  return (
    <div>
      <ul className="divide-y divide-line">
        {target && <RoleRow {...target} target />}
        {visible.map((row) => <RoleRow key={row.role} {...row} />)}
      </ul>
      {others.length > 3 && (
        <Button variant="ghost" size="sm" className="mt-3" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Show top roles only" : `Show all ${rows.length} roles`}
        </Button>
      )}
    </div>
  );
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "skills", label: "Skills" },
  { id: "match", label: "Career match" },
];

// Tab panels all stay in the DOM (inactive ones hidden) so the PDF export can include every section.
export function ResultTabs({ skills, atsBreakdown, mlInsights, matchData, targetRole }) {
  const [tab, setTab] = useState("overview");
  const tabs = TABS.map((item) => (item.id === "skills" ? { ...item, count: skills.length } : item));
  const panels = {
    overview: <OverviewPanel atsBreakdown={atsBreakdown} mlInsights={mlInsights} />,
    skills: <SkillsPanel skills={skills} />,
    match: <MatchPanel matchData={matchData} targetRole={targetRole} />,
  };
  return (
    <Card as="section" aria-label="Analysis details" padding="none" className="px-4 pb-5 pt-2 sm:px-5">
      <Tabs idBase="analysis" label="Analysis details" value={tab} onChange={setTab} tabs={tabs} data-html2canvas-ignore="true" />
      {TABS.map(({ id, label }) => (
        <TabPanel key={id} idBase="analysis" id={id} hidden={tab !== id} data-report-panel="">
          <h2 data-report-heading="" hidden className="mb-3 text-base font-semibold text-ink">{label}</h2>
          {panels[id]}
        </TabPanel>
      ))}
    </Card>
  );
}

export { nextStep };
export const roleMissing = (matchData, role) => (Array.isArray(matchData?.[role]?.missing) ? matchData[role].missing : []);
export const roleScore = (matchData, role) => (matchData?.[role] ? percent(matchData[role].score) : null);
