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

test("renders saved milestones and summary; status badge cycles via PATCH", async () => {
  axios.patch.mockResolvedValue({ data: { ...roadmap, milestones: roadmap.milestones.map((item) =>
    item._id === "m3" ? { ...item, status: "progress" } : item) } });
  render(<Roadmap onNavigate={jest.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");

  const list = await screen.findByRole("list", { name: "Roadmap milestones" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  expect(within(list).getByText("Week 3: learn kubernetes")).toBeInTheDocument();
  expect(within(list).getAllByText("Add docker to Expense Tracker")).toHaveLength(2);
  expect(within(list).getAllByText("kubernetes docs")).toHaveLength(2);
  expect(within(list).getAllByText("Free course")).toHaveLength(4);

  const summary = screen.getByRole("region", { name: "Roadmap summary" });
  expect(within(summary).getByText("50%")).toBeInTheDocument();
  expect(within(summary).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  // docker is fully done; kubernetes is in progress; terraform never fit into the plan.
  expect(within(summary).queryByText("docker")).not.toBeInTheDocument();
  expect(within(summary).getByText("kubernetes")).toBeInTheDocument();
  expect(within(summary).getByText("terraform")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Regenerate ↻" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Week 3 status: Upcoming. Change status" }));
  expect(await screen.findByRole("button", { name: "Week 3 status: In progress. Change status" })).toBeInTheDocument();
  expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/api/roadmap/roadmap/milestone/m3"),
    { status: "progress" }, { headers: { Authorization: "Bearer test-token" } });
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
  fireEvent.click(screen.getByRole("button", { name: "Regenerate ↻" }));
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
