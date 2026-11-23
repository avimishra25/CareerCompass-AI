import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import History from "./History";
import Compare from "./Compare";

jest.mock("axios");

const analyses = [
  { _id: "a2", resumeName: "Rahul_Verma_Resume_v3.pdf", atsScore: 72, skills: ["react", "node", "sql"], bestRole: { role: "fullstack developer", score: 78 },
    targetRole: "fullstack developer", createdAt: "2026-11-20T10:00:00.000Z",
    match: { "fullstack developer": { score: "78" }, "frontend developer": { score: "60" } } },
  { _id: "a1", resumeName: "resume_final.pdf", atsScore: 51, skills: ["react", "html"], bestRole: { role: "frontend developer", score: 40 },
    targetRole: null, createdAt: "2026-10-14T10:00:00.000Z",
    match: { "fullstack developer": { score: "50" }, "frontend developer": { score: "60" } } },
  { _id: "a0", resumeName: "first.pdf", atsScore: 40, skills: [], bestRole: null, targetRole: null, createdAt: "2026-09-01T10:00:00.000Z", match: {} },
];

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("token", "test-token");
});

test("saved analyses render as visible table rows", async () => {
  axios.get.mockResolvedValue({ data: analyses });
  render(<History onNavigate={jest.fn()} />);
  const table = await screen.findByRole("table", { name: "Analyses" });
  for (const name of ["Rahul_Verma_Resume_v3.pdf", "resume_final.pdf"]) {
    // toBeVisible fails on opacity: 0, which is how the rows were hidden in production.
    expect(within(table).getByText(name)).toBeVisible();
  }
  const row = within(table).getByText("Rahul_Verma_Resume_v3.pdf").closest("tr");
  expect(row).toHaveTextContent("Fullstack developer");
  expect(row).toHaveTextContent("72");
  expect(row).toHaveTextContent("20 Nov 2026");
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/history"), { headers: { Authorization: "Bearer test-token" } });
});

test("select two to compare; a third pick replaces the oldest pick", async () => {
  axios.get.mockResolvedValue({ data: analyses });
  const onNavigate = jest.fn();
  render(<History onNavigate={onNavigate} />);
  const compare = await screen.findByRole("button", { name: "Compare selected" });
  expect(compare).toBeDisabled();
  const boxes = screen.getAllByRole("checkbox");
  fireEvent.click(boxes[2]);
  expect(screen.getByRole("status")).toHaveTextContent("1 selected. Select one more to compare.");
  fireEvent.click(boxes[1]);
  fireEvent.click(boxes[0]);
  expect(boxes.map((box) => box.checked)).toEqual([true, true, false]);
  fireEvent.click(compare);
  expect(onNavigate).toHaveBeenCalledWith("compare", { analysisA: analyses[1], analysisB: analyses[0] });
});

test("delete asks inline, and a failure shows an inline error instead of alert()", async () => {
  axios.get.mockResolvedValue({ data: analyses });
  window.alert = jest.fn();
  render(<History onNavigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete first.pdf" }));
  axios.delete.mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete first.pdf" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not delete the analysis. Try again.");
  expect(window.alert).not.toHaveBeenCalled();
  axios.delete.mockResolvedValueOnce({ data: { message: "Deleted" } });
  fireEvent.click(screen.getByRole("button", { name: "Delete first.pdf" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete first.pdf" }));
  await waitFor(() => expect(screen.queryByText("first.pdf")).not.toBeInTheDocument());
  expect(axios.delete).toHaveBeenLastCalledWith(expect.stringContaining("/api/history/a0"), expect.anything());
});

test("empty and failed states", async () => {
  axios.get.mockResolvedValueOnce({ data: [] });
  const onNavigate = jest.fn();
  const { unmount } = render(<History onNavigate={onNavigate} />);
  fireEvent.click(await screen.findByRole("button", { name: "Analyze resume" }));
  expect(onNavigate).toHaveBeenCalledWith("analyze");
  unmount();
  axios.get.mockRejectedValueOnce(new Error("offline"));
  render(<History onNavigate={jest.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your history.");
});

test("Compare orders older to newer whatever the pick order, with change arrows and skill lists", () => {
  // Newer picked first: the bug showed 72 → 51 as a decline.
  render(<Compare analysisA={analyses[0]} analysisB={analyses[1]} onNavigate={jest.fn()} />);
  const table = screen.getByRole("table", { name: "Comparison" });
  const columns = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
  expect(columns[1]).toContain("resume_final.pdf");
  expect(columns[3]).toContain("Rahul_Verma_Resume_v3.pdf");
  const ats = within(table).getByRole("rowheader", { name: "ATS score" }).closest("tr");
  expect(ats).toHaveTextContent("51+21increase72");
  const frontend = within(table).getByRole("rowheader", { name: "Frontend developer" }).closest("tr");
  expect(frontend).toHaveTextContent("No change");
  expect(screen.getByRole("list", { name: "Gained" })).toHaveTextContent("Node.jsSQL");
  expect(screen.getByRole("list", { name: "Removed" })).toHaveTextContent("HTML");
});

test("Compare without two analyses points back to History", () => {
  const onNavigate = jest.fn();
  render(<Compare onNavigate={onNavigate} />);
  fireEvent.click(screen.getByRole("button", { name: "Go to history" }));
  expect(onNavigate).toHaveBeenCalledWith("history");
});
