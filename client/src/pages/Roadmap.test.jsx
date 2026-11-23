import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import Roadmap from "./Roadmap";

jest.mock("axios");
const milestone = (id, week, skill, status = "todo") => ({
  _id: id, week, skill, status, objective: `Week ${week}: learn ${skill}`,
  resources: [`${skill} docs`, "Free course"], miniProject: `Add ${skill} to Expense Tracker`,
});
const roadmap = {
  _id: "roadmap", analysisId: "analysis", jdMatchId: null, targetRole: "devops engineer", hoursPerWeek: 8,
  covered: false, skillGaps: ["docker", "kubernetes", "terraform"],
  milestones: [milestone("m1", 1, "docker", "done"), milestone("m2", 2, "docker", "done"),
    milestone("m3", 3, "kubernetes"), milestone("m4", 4, "kubernetes")],
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("token", "test-token");
  axios.get.mockImplementation((url) => Promise.resolve({ data:
    url.endsWith("/api/roadmap") ? roadmap
      : url.endsWith("jd-match/history") ? []
        : [{ _id: "analysis", resumeName: "resume.pdf", createdAt: "2026-10-05", bestRole: { role: "devops engineer" } }],
  }));
});

test("timeline: current week open and highlighted, finished weeks collapsed; status changes with one click", async () => {
  axios.patch.mockResolvedValue({ data: { ...roadmap, milestones: roadmap.milestones.map((item) =>
    item._id === "m3" ? { ...item, status: "progress" } : item) } });
  render(<Roadmap onNavigate={jest.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");

  const list = await screen.findByRole("list", { name: "Roadmap milestones" });
  expect(list.children).toHaveLength(4);
  const week1 = within(list).getByRole("article", { name: "Week 1: Docker" });
  const week3 = within(list).getByRole("article", { name: "Week 3: Kubernetes" });
  // Current week = first not done: open and marked.
  expect(week3).toHaveTextContent("Week 3 · current");
  expect(within(week3).getByText("Week 3: learn kubernetes")).toBeInTheDocument();
  expect(within(week3).getByText("Add kubernetes to Expense Tracker")).toBeInTheDocument();
  // Finished weeks collapse to one line and expand on demand.
  expect(within(week1).queryByText("Week 1: learn docker")).not.toBeInTheDocument();
  fireEvent.click(within(week1).getByRole("button", { name: /Week 1\s*Docker/ }));
  expect(within(week1).getByText("Add docker to Expense Tracker")).toBeInTheDocument();
  expect(within(list).getAllByText("Free course")).toHaveLength(3);

  const summary = screen.getByRole("region", { name: "Roadmap summary" });
  expect(within(summary).getByText("50%")).toBeInTheDocument();
  expect(within(summary).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  // docker is fully done; kubernetes is in progress; terraform never fit into the plan.
  expect(within(summary).queryByText("Docker")).not.toBeInTheDocument();
  expect(within(summary).getByText("Kubernetes")).toBeInTheDocument();
  expect(within(summary).getByText("Terraform")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();

  fireEvent.click(within(week3).getByRole("button", { name: "Start week 3" }));
  expect(await screen.findByRole("button", { name: "Mark done week 3" })).toBeInTheDocument();
  expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/api/roadmap/roadmap/milestone/m3"),
    { status: "progress" }, { headers: { Authorization: "Bearer test-token" } });
});

test("milestones show their subtopic titles; a covered role shows an empty state instead of a plan", async () => {
  const titled = { ...roadmap, skillGaps: ["rest api"], milestones: [
    { ...milestone("t1", 1, "rest api"), title: "REST API: routing and status codes" },
    { ...milestone("t2", 2, "rest api"), title: "REST API: validation and error handling" },
  ] };
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/api/roadmap") ? titled
    : url.endsWith("jd-match/history") ? [] : [{ _id: "analysis", resumeName: "resume.pdf", createdAt: "2026-10-05" }] }));
  const { unmount } = render(<Roadmap onNavigate={jest.fn()} />);
  const list = await screen.findByRole("list", { name: "Roadmap milestones" });
  expect(within(list).getAllByRole("article").map((card) => card.getAttribute("aria-label")))
    .toEqual(["Week 1: REST API: routing and status codes", "Week 2: REST API: validation and error handling"]);
  unmount();

  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/api/roadmap")
    ? { ...roadmap, covered: true, skillGaps: [], milestones: [] }
    : url.endsWith("jd-match/history") ? [] : [{ _id: "analysis", resumeName: "resume.pdf", createdAt: "2026-10-05" }] }));
  render(<Roadmap onNavigate={jest.fn()} />);
  expect(await screen.findByRole("heading", { name: "You cover this role. Pick another role or add a JD match." })).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Roadmap milestones" })).not.toBeInTheDocument();
});

test("a cross-link pre-selects the analysis, role and JD match without generating", async () => {
  const analyses = [
    { _id: "analysis", resumeName: "resume.pdf", createdAt: "2026-10-05", bestRole: { role: "devops engineer" } },
    { _id: "new", resumeName: "new.pdf", createdAt: "2026-11-20", bestRole: { role: "backend developer" } },
  ];
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/api/roadmap") ? roadmap
    : url.endsWith("jd-match/history") ? [{ _id: "jd", jdTitle: "Platform intern", result: { overall_match: 40 } }] : analyses }));
  axios.post.mockResolvedValue({ data: roadmap });
  const { unmount } = render(<Roadmap onNavigate={jest.fn()} preset={{ analysisId: "new", jdMatchId: "jd" }} />);
  expect(await screen.findByText("JD match “Platform intern” is selected. Regenerate to add its missing skills to your roadmap.")).toBeInTheDocument();
  expect(screen.getByLabelText("Analysis")).toHaveValue("new");
  expect(screen.getByLabelText("JD match (optional)")).toHaveValue("jd");
  // With no role in the link, the role follows the pre-selected analysis, not the saved roadmap.
  expect(screen.getByLabelText("Target role")).toHaveValue("backend developer");
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/roadmap"),
    { analysisId: "new", targetRole: "backend developer", hoursPerWeek: 8, jdMatchId: "jd" }, expect.anything()));
  await waitFor(() => expect(screen.queryByText(/is selected/)).not.toBeInTheDocument());
  unmount();

  // From an ATS report: analysis + target role, and no JD match carried over from the saved roadmap.
  render(<Roadmap onNavigate={jest.fn()} preset={{ analysisId: "new", targetRole: "cloud architect" }} />);
  expect(await screen.findByText("Your analysis “new.pdf” is selected. Regenerate to build a roadmap from it.")).toBeInTheDocument();
  expect(screen.getByLabelText("Target role")).toHaveValue("cloud architect");
  expect(screen.getByLabelText("JD match (optional)")).toHaveValue("");
});

test("generate sends selected options; API errors are shown", async () => {
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/api/roadmap") ? null
    : url.endsWith("jd-match/history") ? [{ _id: "jd", jdTitle: "Platform intern", result: { overall_match: 40 } }]
      : [{ _id: "analysis", resumeName: "resume.pdf", createdAt: "2026-10-05", bestRole: { role: "devops engineer" } }] }));
  axios.post.mockRejectedValue({ response: { data: { error: "AI returned an invalid roadmap. Try again." } } });
  render(<Roadmap onNavigate={jest.fn()} />);
  expect(await screen.findByText(/No roadmap yet/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("JD match (optional)"), { target: { value: "jd" } });
  fireEvent.change(screen.getByLabelText("Hours / week"), { target: { value: "50" } });
  expect(screen.getByRole("button", { name: "Generate roadmap" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Hours / week"), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Generate roadmap" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("AI returned an invalid roadmap. Try again.");
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/roadmap"),
    { analysisId: "analysis", targetRole: "devops engineer", hoursPerWeek: 10, jdMatchId: "jd" },
    { headers: { Authorization: "Bearer test-token" } });
});
