import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";
import { Badge, Button, EmptyState, InlineAlert, Input, ProgressBar, ScoreRing, Select, Skeleton, TabPanel, Tabs, Textarea, Tooltip, scoreTone } from ".";
import { roleIcon, roleLabel, ROLES, TARGET_ROLES } from "../../constants/targetRoles";

test("Button: variants, loading keeps it disabled and busy, icon-only uses its aria-label", () => {
  const onClick = jest.fn();
  const { rerender } = render(<Button variant="primary" icon={Plus} onClick={onClick}>New analysis</Button>);
  const button = screen.getByRole("button", { name: "New analysis" });
  expect(button).toHaveAttribute("type", "button");
  expect(button.className).toContain("bg-brand");
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
  rerender(<Button variant="primary" loading onClick={onClick}>New analysis</Button>);
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
  rerender(<Button icon={Plus} aria-label="Add" />);
  expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
});

test("ScoreRing: accessible label, tone thresholds and 0–10 formatting", () => {
  render(<><ScoreRing value={72} label="ATS score" /><ScoreRing value={7} max={10} /><ScoreRing value={null} label="ATS score" /></>);
  expect(screen.getByRole("img", { name: "ATS score 72 out of 100" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Score 7.0 out of 10" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "ATS score not available" })).toBeInTheDocument();
  expect([scoreTone(49), scoreTone(50), scoreTone(74), scoreTone(75), scoreTone(4.9, 10), scoreTone(7.5, 10)])
    .toEqual(["warning", "brand", "brand", "success", "warning", "success"]);
});

test("ProgressBar exposes value and range", () => {
  render(<ProgressBar value={6} min={1} max={10} label="Structure" />);
  const bar = screen.getByRole("progressbar", { name: "Structure" });
  expect(bar).toHaveAttribute("aria-valuenow", "6");
  expect(bar).toHaveAttribute("aria-valuemin", "1");
  expect(bar).toHaveAttribute("aria-valuemax", "10");
});

function TabsDemo() {
  const [tab, setTab] = useState("overview");
  return (
    <>
      <Tabs idBase="t" label="Results" value={tab} onChange={setTab}
        tabs={[{ id: "overview", label: "Overview" }, { id: "skills", label: "Skills", count: 12 }, { id: "match", label: "Career match" }]} />
      <TabPanel idBase="t" id={tab}>Panel {tab}</TabPanel>
    </>
  );
}

test("Tabs: arrow keys, Home and End move focus and selection; panel is labelled by its tab", () => {
  render(<TabsDemo />);
  const overview = screen.getByRole("tab", { name: "Overview" });
  expect(overview).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: "Skills 12" })).toHaveAttribute("tabindex", "-1");
  fireEvent.keyDown(overview, { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Skills 12" })).toHaveFocus();
  expect(screen.getByRole("tabpanel", { name: "Skills 12" })).toHaveTextContent("Panel skills");
  fireEvent.keyDown(document.activeElement, { key: "End" });
  expect(screen.getByRole("tab", { name: "Career match" })).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(document.activeElement, { key: "ArrowRight" });
  expect(overview).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "ArrowLeft" });
  expect(screen.getByRole("tab", { name: "Career match" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "Home" });
  expect(overview).toHaveAttribute("aria-selected", "true");
});

test("Fields: labels, hints and errors are wired; the counter counts code points and flags overflow", () => {
  const { rerender } = render(<>
    <Input label="JD title" hint="Optional" defaultValue="" />
    <Select label="Analysis" options={[{ value: "a", label: "resume.pdf" }]} error="Choose an analysis" defaultValue="a" />
    <Textarea label="Job description" maxLength={5} value="😀😀😀" onChange={() => {}} />
  </>);
  expect(screen.getByLabelText("JD title")).toHaveAccessibleDescription("Optional");
  expect(screen.getByLabelText("Analysis")).toHaveAccessibleDescription("Choose an analysis");
  expect(screen.getByLabelText("Analysis")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("3 / 5 characters")).toBeInTheDocument();
  rerender(<Textarea label="Job description" maxLength={5} value="123456" onChange={() => {}} />);
  expect(screen.getByLabelText("Job description")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("6 / 5 characters").className).toContain("text-danger");
});

test("Tooltip shows on focus, hides on Esc and describes its trigger", () => {
  render(<Tooltip content="5 matched · 2 missing"><button type="button">Skills</button></Tooltip>);
  const trigger = screen.getByRole("button", { name: "Skills" });
  const tip = screen.getByRole("tooltip", { hidden: true });
  expect(trigger).toHaveAccessibleDescription("5 matched · 2 missing");
  expect(tip.className).toContain("invisible");
  fireEvent.focus(trigger);
  expect(tip.className).toContain("visible opacity-100");
  fireEvent.keyDown(trigger, { key: "Escape" });
  expect(tip.className).toContain("invisible");
});

test("EmptyState, InlineAlert, Skeleton and Badge", () => {
  const onDismiss = jest.fn();
  render(<>
    <EmptyState title="No analyses yet" description="Upload a resume to see your score." action={<Button>Analyze resume</Button>} />
    <InlineAlert title="Could not delete" onDismiss={onDismiss}>Try again.</InlineAlert>
    <InlineAlert tone="info">Saved</InlineAlert>
    <Skeleton lines={3} label="Loading history" />
    <Badge tone="success">Strong</Badge>
  </>);
  expect(screen.getByRole("heading", { name: "No analyses yet" })).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Could not delete");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(onDismiss).toHaveBeenCalled();
  expect(screen.getAllByRole("status").map((node) => node.textContent)).toEqual(["Saved", "Loading history"]);
  expect(screen.getByText("Strong").parentElement.className).toContain("text-success");
});

test("all 12 roles have a sentence-case label and an icon, without emoji", () => {
  expect(ROLES).toHaveLength(12);
  expect(TARGET_ROLES[0].value).toBe("");
  for (const role of ROLES) {
    expect(role.icon).toBeTruthy();
    expect(role.label).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(role.label[0]).toBe(role.label[0].toUpperCase());
  }
  expect(roleLabel("ui/ux designer")).toBe("UI/UX designer");
  expect(roleLabel("cloud engineer")).toBe("Cloud engineer");
  expect(roleIcon("unknown")).toBeTruthy();
});
