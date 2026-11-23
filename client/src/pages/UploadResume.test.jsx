import { fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import UploadResume from "./UploadResume";
import { nextStep } from "../components/analysis/nextStep";

jest.mock("axios");
jest.mock("html2canvas", () => jest.fn(() => Promise.resolve({ width: 100, height: 100, toDataURL: () => "data:image/png;base64," })));

const ROLE_SCORES = { "fullstack developer": [78, ["sql", "git"]], "backend developer": [72, ["redis"]], "frontend developer": [64, ["typescript"]],
  "data scientist": [41, ["pandas"]], "ml engineer": [33, ["pytorch"]], "devops engineer": [30, ["docker"]] };
const match = Object.fromEntries(Object.entries(ROLE_SCORES).map(([role, [score, missing]]) => [role, { score: String(score), missing, emoji: "x" }]));
const skills = ["javascript", "react", "node", "express", "mongodb", "python", "flask", "git", "docker", "css", "html", "sql", "redis", "jest", "aws",
  "figma", "kafka", "linux", "nginx", "graphql"];
const result = (overrides = {}) => ({
  analysisId: "new-analysis", skills, match, bestRole: { role: "backend developer", score: 72 }, atsScore: 66,
  atsBreakdown: { skills: { score: 18 }, verbs: { score: 12, found: ["built", "led"] }, quantified: { score: 8 }, sections: { score: 16 }, length: { score: 10, words: 512 } },
  mlInsights: { top_drivers: [{ feature: "skill_count", label: "Number of skills", your_value: 20 }],
    improve_here: [{ feature: "quant_count", label: "Quantified results", tip: "Add numbers to your achievements." }] },
  targetRoleAnalysis: null, ...overrides,
});
const pdf = () => new File(["%PDF-1.4"], "Test_User_Resume.pdf", { type: "application/pdf" });

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("token", "test-token");
});

async function analyze(overrides, props = {}) {
  axios.post.mockResolvedValue({ data: result(overrides) });
  const onNavigate = jest.fn();
  const file = pdf();
  render(<UploadResume onNavigate={onNavigate} presetFile={file} {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Analyze resume" }));
  await screen.findByRole("region", { name: "Analysis summary" });
  return { onNavigate, file };
}

test("a builder PDF is pre-attached; the next-step card links to roadmap and interview with this analysis and role", async () => {
  const { onNavigate, file } = await analyze();
  expect(axios.post.mock.calls[0][1].get("resume")).toBe(file);
  expect(axios.post.mock.calls[0][0]).toMatch(/\/upload$/);

  const card = screen.getByRole("region", { name: /Build a roadmap for 1 missing skill/ });
  expect(within(card).getByText("Your next step")).toBeInTheDocument();
  expect(card).toHaveAttribute("data-html2canvas-ignore", "true");
  const steps = within(card).getByRole("group", { name: "Next steps" });
  fireEvent.click(within(steps).getByRole("button", { name: "Build roadmap" }));
  expect(onNavigate).toHaveBeenLastCalledWith("roadmap", { analysisId: "new-analysis", targetRole: "backend developer" });
  fireEvent.click(within(steps).getByRole("button", { name: "Practise interview" }));
  expect(onNavigate).toHaveBeenLastCalledWith("interview", { analysisId: "new-analysis", role: "backend developer" });
});

test("summary row, overview, skills grouped by category, and compact career match", async () => {
  await analyze();
  const summary = screen.getByRole("region", { name: "Analysis summary" });
  expect(within(summary).getByRole("img", { name: "ATS score 66 out of 100" })).toBeInTheDocument();
  expect(within(summary).getByText("Good")).toBeInTheDocument();
  expect(within(summary).getByText("Match for Backend developer").nextSibling).toHaveTextContent("72%");
  expect(within(summary).getByText("Skills found").nextSibling).toHaveTextContent("20");
  expect(within(summary).getByText("Test_User_Resume.pdf")).toBeInTheDocument();

  // Overview is the default tab.
  expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("progressbar", { name: "Quantified results" })).toHaveAttribute("aria-valuenow", "8");
  expect(screen.getByText("Add numbers to your achievements.")).toBeVisible();

  fireEvent.click(screen.getByRole("tab", { name: "Skills 20" }));
  const skillsPanel = screen.getByRole("tabpanel", { name: "Skills 20" });
  expect(within(skillsPanel).getByRole("heading", { name: "Languages 3" })).toBeInTheDocument();
  expect(within(skillsPanel).getByText("JavaScript")).toBeInTheDocument();
  expect(within(skillsPanel).getByRole("heading", { name: "Backend 4" })).toBeInTheDocument();
  expect(document.getElementById("analysis-panel-overview")).not.toBeVisible();

  fireEvent.click(screen.getByRole("tab", { name: "Career match" }));
  const matchPanel = screen.getByRole("tabpanel", { name: "Career match" });
  // Target (best) role first, then the top 3 others, the rest behind "Show all".
  const rows = () => within(matchPanel).getAllByRole("progressbar").map((bar) => bar.getAttribute("aria-label"));
  expect(rows()).toEqual(["Backend developer match", "Fullstack developer match", "Frontend developer match", "Data scientist match"]);
  fireEvent.click(within(matchPanel).getByRole("button", { name: "Show all 6 roles" }));
  expect(rows()).toHaveLength(6);
  const missing = within(matchPanel).getAllByRole("button", { name: "2 missing" })[0];
  expect(missing).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(missing);
  expect(within(matchPanel).getByRole("list", { name: "Missing for Fullstack developer" })).toHaveTextContent("SQLGit");
});

test("next step: weak score fixes the resume first; no gaps suggests interview practice", () => {
  const tip = { label: "Quantified results", tip: "Add numbers." };
  expect(nextStep({ atsScore: 52, mlInsights: { improve_here: [tip] }, role: "backend developer", missing: ["redis"] }))
    .toMatchObject({ kind: "resume", title: "Quantified results", action: "Open resume builder" });
  expect(nextStep({ atsScore: 70, mlInsights: { improve_here: [tip] }, role: "backend developer", missing: ["redis", "docker", "aws", "kafka"] }))
    .toMatchObject({ kind: "roadmap", title: "Build a roadmap for 4 missing skills", text: expect.stringContaining("Redis, Docker, AWS and 1 more") });
  expect(nextStep({ atsScore: 80, mlInsights: null, atsBreakdown: { quantified: { score: 20 }, verbs: { score: 20 }, sections: { score: 20 }, skills: { score: 30 } }, role: "data scientist", missing: [] }))
    .toMatchObject({ kind: "interview", title: "Practise an interview for Data scientist" });
});

test("upload errors are inline; the report download includes every tab", async () => {
  axios.post.mockRejectedValueOnce({ response: { status: 503, data: { error: "Analysis failed" } } });
  render(<UploadResume onNavigate={jest.fn()} presetFile={pdf()} />);
  fireEvent.click(screen.getByRole("button", { name: "Analyze resume" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Analysis failed. Check the file and try again in a minute.");

  axios.post.mockResolvedValueOnce({ data: result() });
  fireEvent.click(screen.getByRole("button", { name: "Analyze resume" }));
  await screen.findByRole("region", { name: "Analysis summary" });
  const html2canvas = require("html2canvas");
  fireEvent.click(screen.getByRole("button", { name: "Download report" }));
  await screen.findByRole("button", { name: "Download report" });
  const { onclone } = html2canvas.mock.calls[0][1];
  const clone = document.createElement("div");
  clone.innerHTML = '<div data-report-panel hidden></div><h2 data-report-heading hidden></h2>';
  onclone(clone);
  expect([...clone.querySelectorAll("[hidden]")]).toHaveLength(0);
});

test("a long skill group shows 12, then +N more", () => {
  const { ResultTabs } = require("../components/analysis/AnalysisResults");
  const many = Array.from({ length: 15 }, (_, index) => `tool ${index + 1}`);
  render(<ResultTabs skills={many} atsBreakdown={{}} mlInsights={null} matchData={{}} targetRole="" />);
  fireEvent.click(screen.getByRole("tab", { name: "Skills 15" }));
  const panel = screen.getByRole("tabpanel", { name: "Skills 15" });
  expect(within(panel).getByRole("heading", { name: "Other 15" })).toBeInTheDocument();
  expect(within(panel).queryByText("Tool 13")).not.toBeInTheDocument();
  fireEvent.click(within(panel).getByRole("button", { name: "+3 more" }));
  expect(within(panel).getByText("Tool 15")).toBeInTheDocument();
  expect(within(panel).getByRole("button", { name: "Show fewer" })).toHaveAttribute("aria-expanded", "true");
});
