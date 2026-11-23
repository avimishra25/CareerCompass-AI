import { fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import Dashboard from "./Dashboard";

jest.mock("axios");
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { name: "Rahul Verma" } }) }));
jest.mock("../components/ProgressTracker", () => () => <div>Progress chart</div>);

const summary = {
  analyses: { count: 3, averageAts: 64, latestAts: 72, topRole: "backend developer", latestAnalysisId: "a1", latestAnalysisAt: "2026-11-20T10:00:00.000Z" },
  jdMatches: { count: 2, best: 85 },
  roadmap: { id: "r1", targetRole: "devops engineer", covered: false, total: 6, done: 2, completion: 33,
    nextMilestone: { week: 3, skill: "kubernetes", objective: "Pods and services", status: "progress" } },
  interview: { readiness: 7.6, sessions: 5, change: 1.2, lastScore: 8 },
};
const data = {
  "/api/dashboard/summary": summary,
  "/api/history": [{ atsScore: 72 }, { atsScore: null }, { atsScore: 64 }],
  "/api/interview/history": [
    { _id: "s2", role: "fullstack developer", status: "active", createdAt: "2026-11-22T09:00:00.000Z",
      questions: [{ qid: "q1", answeredAt: "2026-11-22" }, { qid: "q2", answeredAt: null }, { qid: "q3" }, { qid: "q4" }, { qid: "q5" }] },
    { _id: "s1", status: "completed", questions: [] },
  ],
  "/api/resume-builder/drafts": [{ _id: "d1", title: "Internship resume", atsScore: 68, updatedAt: "2026-11-21T12:00:00.000Z" }],
};
const respond = (overrides = {}) => axios.get.mockImplementation((url) => {
  const path = Object.keys({ ...data, ...overrides }).find((key) => url.endsWith(key));
  const value = { ...data, ...overrides }[path];
  return value instanceof Error ? Promise.reject(value) : Promise.resolve({ data: value });
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("token", "test-token");
});

test("KPIs, continue rows and the chart come from the summary plus existing history endpoints", async () => {
  respond();
  const onNavigate = jest.fn();
  render(<Dashboard onNavigate={onNavigate} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Good (morning|afternoon|evening), Rahul$/);

  const kpis = screen.getByRole("region", { name: "Key metrics" });
  const ats = await within(kpis).findByRole("button", { name: /^ATS score 72\/100/ });
  // Change since the previous analysis that has a score: 72 − 64.
  expect(ats).toHaveTextContent("+8 since last analysis");
  const roadmap = within(kpis).getByRole("button", { name: /^Roadmap progress 33%/ });
  expect(within(roadmap).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
  expect(roadmap).toHaveTextContent("2 of 6 weeks");
  expect(within(kpis).getByRole("button", { name: /^Interview readiness 7\.6\/10/ })).toHaveTextContent("+1.2 vs previous 5");
  const jd = within(kpis).getByRole("button", { name: /^Best JD match 85\/100/ });
  expect(jd).toHaveTextContent("Across 2 job descriptions");
  for (const [button, page] of [[ats, "history"], [roadmap, "roadmap"], [jd, "jd-match"]]) {
    fireEvent.click(button);
    expect(onNavigate).toHaveBeenLastCalledWith(page);
  }

  const continuing = screen.getByRole("region", { name: "Continue where you left off" });
  expect(within(continuing).getByText("Week 3 · Kubernetes")).toBeInTheDocument();
  expect(within(continuing).getByText("1 of 5 questions answered · started 22 Nov")).toBeInTheDocument();
  expect(within(continuing).getByText("Internship resume")).toBeInTheDocument();
  for (const [name, page] of [[/^Open roadmap/, "roadmap"], [/^Resume session/, "interview"], [/^Open draft/, "resume-builder"]]) {
    fireEvent.click(within(continuing).getByRole("button", { name }));
    expect(onNavigate).toHaveBeenLastCalledWith(page);
  }
  // One primary action: the next roadmap milestone comes first.
  fireEvent.click(screen.getByRole("button", { name: "Continue roadmap" }));
  expect(onNavigate).toHaveBeenLastCalledWith("roadmap");
  expect(screen.getByText("Progress chart")).toBeInTheDocument();

  const called = axios.get.mock.calls.map(([url]) => url.replace(/^.*?(\/api\/)/, "$1")).sort();
  expect(called).toEqual(["/api/dashboard/summary", "/api/history", "/api/interview/history", "/api/resume-builder/drafts"]);
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/dashboard/summary"), { headers: { Authorization: "Bearer test-token" } });
});

test("optional extras failing does not block the dashboard", async () => {
  respond({ "/api/interview/history": new Error("offline"), "/api/resume-builder/drafts": new Error("offline") });
  render(<Dashboard onNavigate={jest.fn()} />);
  expect(await screen.findByText("Week 3 · Kubernetes")).toBeInTheDocument();
  expect(screen.queryByText(/questions answered/)).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("new users see one clear first step; nothing-in-progress has its own empty state", async () => {
  respond({ "/api/dashboard/summary": { ...summary, analyses: { ...summary.analyses, count: 0, latestAts: null } } });
  const onNavigate = jest.fn();
  const { unmount } = render(<Dashboard onNavigate={onNavigate} />);
  expect(await screen.findByRole("heading", { name: "Analyze your first resume" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Key metrics" })).not.toBeInTheDocument();
  const buttons = screen.getAllByRole("button", { name: "Analyze resume" });
  fireEvent.click(buttons[buttons.length - 1]);
  expect(onNavigate).toHaveBeenCalledWith("analyze");
  unmount();

  respond({
    "/api/dashboard/summary": { ...summary, analyses: { ...summary.analyses, count: 1 }, roadmap: null, interview: null, jdMatches: { count: 0, best: null } },
    "/api/history": [{ atsScore: 72 }], "/api/interview/history": [], "/api/resume-builder/drafts": [],
  });
  render(<Dashboard onNavigate={jest.fn()} />);
  expect(await screen.findByRole("heading", { name: "Nothing in progress" })).toBeInTheDocument();
  const kpis = screen.getByRole("region", { name: "Key metrics" });
  expect(within(kpis).getByRole("button", { name: /^ATS score 72\/100/ })).toHaveTextContent("Your first analysis");
  expect(within(kpis).getByRole("button", { name: /^Roadmap progress/ })).toHaveTextContent("No roadmap yet");
  expect(within(kpis).getByRole("button", { name: /^Interview readiness/ })).toHaveTextContent("No sessions yet");
  expect(within(kpis).getByRole("button", { name: /^Best JD match/ })).toHaveTextContent("No matches yet");
  expect(screen.queryByText("Progress chart")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Practise interview" })).toBeInTheDocument();
});

test("a failed summary shows an inline error with a retry", async () => {
  respond({ "/api/dashboard/summary": new Error("offline") });
  render(<Dashboard onNavigate={jest.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your dashboard.");
  respond();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("region", { name: "Key metrics" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
