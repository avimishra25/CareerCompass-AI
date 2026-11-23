import { fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import Dashboard from "./Dashboard";

jest.mock("axios");
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { name: "Test User" } }) }));
jest.mock("../components/ProgressTracker", () => () => <div>Progress tracker</div>);

const summary = {
  analyses: { count: 3, averageAts: 64, latestAts: 70, topRole: "backend developer", latestAnalysisId: "a1", latestAnalysisAt: "2026-11-20T10:00:00.000Z" },
  jdMatches: { count: 2, best: 85 },
  roadmap: { id: "r1", targetRole: "devops engineer", covered: false, total: 4, done: 2, completion: 50,
    nextMilestone: { week: 3, skill: "kubernetes", objective: "Pods", status: "progress" } },
  interview: { readiness: 7.6, sessions: 5, change: 1.2, lastScore: 8 },
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("token", "test-token");
});

test("all stats come from one summary request; cards and quick actions navigate", async () => {
  axios.get.mockResolvedValue({ data: summary });
  const onNavigate = jest.fn();
  render(<Dashboard onNavigate={onNavigate} />);

  const stats = await screen.findByRole("region", { name: "Your stats" });
  expect(await within(stats).findByRole("button", { name: "3 Analyses Done" })).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/dashboard/summary"),
    { headers: { Authorization: "Bearer test-token" } });
  expect(within(stats).getByRole("button", { name: "64 Avg ATS Score Latest: 70" })).toBeInTheDocument();
  expect(within(stats).getByText("backend developer")).toBeInTheDocument();
  expect(within(stats).getByRole("button", { name: "2 JD Matches" })).toBeInTheDocument();

  const roadmap = within(stats).getByRole("button", { name: /^50% Roadmap Completion/ });
  expect(roadmap).toHaveTextContent("Next: week 3 · kubernetes");
  expect(within(roadmap).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  fireEvent.click(roadmap);
  expect(onNavigate).toHaveBeenLastCalledWith("roadmap");

  const readiness = within(stats).getByRole("button", { name: /^7\.6\/10 Interview Readiness/ });
  expect(readiness).toHaveTextContent("▲ 1.2 vs previous 5");
  fireEvent.click(readiness);
  expect(onNavigate).toHaveBeenLastCalledWith("interview");
  fireEvent.click(within(stats).getByRole("button", { name: "85/100 Best JD Match" }));
  expect(onNavigate).toHaveBeenLastCalledWith("jd-match");

  const actions = screen.getByRole("region", { name: "Quick actions" });
  for (const [title, page] of [["Career Roadmap", "roadmap"], ["AI Resume Builder", "resume-builder"], ["Interview Prep", "interview"]]) {
    fireEvent.click(within(actions).getByRole("button", { name: new RegExp(`^${title} →`) }));
    expect(onNavigate).toHaveBeenLastCalledWith(page);
  }
  expect(within(actions).getByText("Next: week 3 · kubernetes")).toBeInTheDocument();
  expect(within(actions).getByText(/Last session 8\.0\/10/)).toBeInTheDocument();
  // The ATS / skills progress tracker still shows once there are 2+ analyses.
  expect(screen.getByText("Progress tracker")).toBeInTheDocument();
});

test("new users see empty states; a failed request shows an error", async () => {
  axios.get.mockResolvedValueOnce({ data: {
    analyses: { count: 0, averageAts: null, latestAts: null, topRole: null, latestAnalysisId: null, latestAnalysisAt: null },
    jdMatches: { count: 0, best: null }, roadmap: null, interview: null,
  } });
  const { unmount } = render(<Dashboard onNavigate={jest.fn()} />);
  const stats = await screen.findByRole("region", { name: "Your stats" });
  expect(await within(stats).findByRole("button", { name: "— Roadmap Completion No roadmap yet" })).toBeInTheDocument();
  expect(within(stats).getByRole("button", { name: "— Interview Readiness No sessions yet" })).toBeInTheDocument();
  expect(within(stats).getByRole("button", { name: "Never Last Analysis" })).toBeInTheDocument();
  expect(screen.queryByText("Progress tracker")).not.toBeInTheDocument();
  unmount();

  axios.get.mockRejectedValueOnce(new Error("offline"));
  render(<Dashboard onNavigate={jest.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your dashboard stats.");
});
