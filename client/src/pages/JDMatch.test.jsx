import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import JDMatch from "./JDMatch";
import Dashboard from "./Dashboard";

jest.mock("axios");
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { name: "Test User" } }) }));
const match = { _id: "match", jdTitle: "Backend", createdAt: "2026-10-05", result: {
  overall_match: 85, verdict: "Strong", matched_skills: ["python"], missing_skills: ["docker"],
  extra_skills: ["react"], keyword_gaps: ["deployment"],
} };
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("token", "test-token");
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("jd-match/history") ? [] : [
    { _id: "analysis", resumeName: "resume.pdf", createdAt: "2026-10-05" },
  ] }));
});

test("submit saved analysis, display score/gaps, reopen history, delete", async () => {
  axios.post.mockResolvedValue({ data: match });
  axios.delete.mockResolvedValue({ data: { message: "Deleted" } });
  render(<JDMatch />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  fireEvent.change(await screen.findByLabelText("Job description"), { target: { value: "Python Docker deployment" } });
  fireEvent.change(screen.getByLabelText("JD title (optional)"), { target: { value: "Backend" } });
  fireEvent.click(screen.getByRole("button", { name: "Match JD" }));
  expect(await screen.findByText("Strong match")).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/jd-match"), {
    analysisId: "analysis", jd_text: "Python Docker deployment", jdTitle: "Backend",
  }, { headers: { Authorization: "Bearer test-token" } });
  for (const text of ["85", "python", "docker", "react", "deployment"]) expect(screen.getByText(text)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Backend.*85\/100/ }));
  fireEvent.click(screen.getByRole("button", { name: "Delete Backend" }));
  await waitFor(() => expect(screen.queryByLabelText("Match result")).not.toBeInTheDocument());
  expect(screen.getByText("No matches yet.")).toBeInTheDocument();
});

test("empty and overlength JD disabled; API error shown", async () => {
  axios.post.mockRejectedValue({ response: { data: { error: "Upload the resume again." } } });
  render(<JDMatch />);
  const input = await screen.findByLabelText("Job description");
  const submit = screen.getByRole("button", { name: "Match JD" });
  expect(submit).toBeDisabled();
  fireEvent.change(input, { target: { value: "x".repeat(8001) } });
  expect(submit).toBeDisabled();
  fireEvent.change(input, { target: { value: "Python" } });
  fireEvent.click(submit);
  expect(await screen.findByRole("alert")).toHaveTextContent("Upload the resume again.");
});

test("load failure is visible", async () => {
  axios.get.mockRejectedValue(new Error("offline"));
  render(<JDMatch />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load JD matching.");
});

test("dashboard shows JD count and best score and links to JD Match", async () => {
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("jd-match/history")
    ? [match, { ...match, result: { ...match.result, overall_match: 60 } }] : [] }));
  const onNavigate = jest.fn();
  render(<Dashboard onNavigate={onNavigate} />);
  expect(await screen.findByText("85/100")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "2 JD Matches" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "85/100 Best JD Match" }));
  expect(onNavigate).toHaveBeenCalledWith("jd-match");
});
