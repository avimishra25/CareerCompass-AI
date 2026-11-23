import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import JDMatch from "./JDMatch";

jest.mock("axios");
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
  fireEvent.change(screen.getByLabelText("Job title (optional)"), { target: { value: "Backend" } });
  fireEvent.click(screen.getByRole("button", { name: "Match job description" }));
  const resultCard = await screen.findByRole("region", { name: "Match result" });
  expect(within(resultCard).getByText("Strong")).toBeInTheDocument();
  expect(within(resultCard).getByRole("img", { name: "JD match 85 out of 100" })).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/jd-match"), {
    analysisId: "analysis", jd_text: "Python Docker deployment", jdTitle: "Backend",
  }, { headers: { Authorization: "Bearer test-token" } });
  for (const [group, text] of [["Matched skills", "Python"], ["Missing skills", "Docker"], ["Extra skills", "React"], ["Keyword gaps", "deployment"]]) {
    expect(within(resultCard).getByRole("list", { name: group })).toHaveTextContent(text);
  }
  fireEvent.click(screen.getByRole("button", { name: "Open Backend, 85/100, Strong" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete Backend" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete Backend" }));
  await waitFor(() => expect(screen.queryByLabelText("Match result")).not.toBeInTheDocument());
  expect(screen.getByRole("heading", { name: "No matches yet" })).toBeInTheDocument();
});

test("empty and overlength JD disabled; API error shown", async () => {
  axios.post.mockRejectedValue({ response: { data: { error: "Upload the resume again." } } });
  render(<JDMatch />);
  const input = await screen.findByLabelText("Job description");
  const submit = screen.getByRole("button", { name: "Match job description" });
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

test("a match result links to the roadmap (with its gaps) and to interview practice for the job", async () => {
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("jd-match/history")
    ? [{ ...match, analysisId: "analysis" }] : [{ _id: "analysis", resumeName: "resume.pdf", createdAt: "2026-10-05" }] }));
  const onNavigate = jest.fn();
  render(<JDMatch onNavigate={onNavigate} />);
  fireEvent.click(await screen.findByRole("button", { name: /^Open Backend/ }));
  const steps = within(screen.getByRole("region", { name: "Match result" })).getByRole("group", { name: "Next steps" });
  fireEvent.click(within(steps).getByRole("button", { name: "Add these gaps to my roadmap" }));
  expect(onNavigate).toHaveBeenLastCalledWith("roadmap", { analysisId: "analysis", jdMatchId: "match" });
  fireEvent.click(within(steps).getByRole("button", { name: "Practise interview for this job" }));
  expect(onNavigate).toHaveBeenLastCalledWith("interview", { jdMatchId: "match", jdTitle: "Backend" });
});

test("no roadmap link when the job has no missing skills", async () => {
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("jd-match/history")
    ? [{ ...match, analysisId: "analysis", result: { ...match.result, missing_skills: [] } }] : [] }));
  render(<JDMatch onNavigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: /^Open Backend/ }));
  expect(screen.queryByRole("button", { name: /Add these gaps/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Practise interview for this job" })).toBeInTheDocument();
});
