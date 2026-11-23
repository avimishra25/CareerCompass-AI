import React, { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Skeleton, TabPanel, Tabs } from "./ui";
import { useAppData } from "../context/AppDataContext";

// One metric at a time, one brand-colour line, horizontal gridlines only.
const METRICS = [
  { id: "ats", label: "ATS score", key: "ats", domain: [0, 100], unit: "/100" },
  { id: "match", label: "Role match", key: "match", domain: [0, 100], unit: "%" },
  { id: "skills", label: "Skills", key: "skills", domain: [0, "auto"], unit: "" },
];
const AXIS_TICK = { fontSize: 12, fill: "#667085", fontFamily: "Inter, system-ui, sans-serif" };
const formatDate = (value) => new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "short" });

function ChartTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2 text-xs shadow-overlay">
      <p className="text-ink-muted">{label}</p>
      <p className="tabular mt-0.5 text-sm font-medium text-ink">{payload[0].value}{metric.unit}</p>
    </div>
  );
}

export default function ProgressTracker() {
  const { history, loading } = useAppData();
  const [metricId, setMetricId] = useState("ats");
  const metric = METRICS.find((item) => item.id === metricId);
  const points = useMemo(() => [...(history || [])]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((item) => ({
      label: formatDate(item.createdAt),
      ats: Number.isFinite(item.atsScore) ? item.atsScore : null,
      match: Number.isFinite(item.bestRole?.score) ? item.bestRole.score : null,
      skills: item.skills?.length ?? 0,
    })), [history]);

  if (loading && !history) return <Card title="Progress over time"><Skeleton className="h-48" label="Loading progress" /></Card>;
  if (points.length < 2) return null;

  const first = points[0], last = points[points.length - 1];
  const delta = (key) => (last[key] != null && first[key] != null ? last[key] - first[key] : null);
  const signed = (value) => (value > 0 ? `+${value}` : `${value}`);
  const atsDelta = delta("ats"), skillDelta = delta("skills");

  return (
    <Card
      title="Progress over time"
      description={`${points.length} analyses, oldest to newest. ${[
        atsDelta != null && `ATS ${signed(atsDelta)} points`, `${signed(skillDelta)} skills`,
      ].filter(Boolean).join(" and ")} since ${first.label}.`}
    >
      <Tabs idBase="progress" label="Chart metric" value={metricId} onChange={setMetricId}
        tabs={METRICS.map(({ id, label }) => ({ id, label }))} />
      <TabPanel idBase="progress" id={metricId} className="pt-4">
        <div className="h-56" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#EAECF0" />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} />
              <YAxis domain={metric.domain} allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<ChartTooltip metric={metric} />} cursor={{ stroke: "#D0D5DD" }} />
              <Line type="monotone" dataKey={metric.key} stroke="#0F766E" strokeWidth={2} connectNulls isAnimationActive={false}
                dot={{ r: 3, fill: "#0F766E", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#0F766E", stroke: "#fff", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* The same data as text for screen readers. */}
        <table className="sr-only">
          <caption>{metric.label} by analysis date</caption>
          <thead><tr><th>Date</th><th>{metric.label}</th></tr></thead>
          <tbody>{points.map((point, index) => <tr key={index}><td>{point.label}</td><td>{point[metric.key] ?? "–"}</td></tr>)}</tbody>
        </table>
      </TabPanel>
    </Card>
  );
}
