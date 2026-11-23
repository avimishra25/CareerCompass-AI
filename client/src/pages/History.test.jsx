import { render, screen } from "@testing-library/react";
import axios from "axios";
import History from "./History";

jest.mock("axios");

const analyses = [
  { _id: "a2", resumeName: "Rahul_Verma_Resume_v3.pdf", atsScore: 72, skills: ["react", "node"], bestRole: { role: "fullstack developer", score: 78 }, targetRole: "fullstack developer", createdAt: "2026-11-20T10:00:00.000Z", match: {} },
  { _id: "a1", resumeName: "resume_final.pdf", atsScore: 51, skills: ["html"], bestRole: { role: "frontend developer", score: 40 }, targetRole: null, createdAt: "2026-10-14T10:00:00.000Z", match: {} },
];

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("token", "test-token");
});

test("saved analyses render as visible rows", async () => {
  axios.get.mockResolvedValue({ data: analyses });
  render(<History onNavigate={jest.fn()} />);
  for (const name of ["Rahul_Verma_Resume_v3.pdf", "resume_final.pdf"]) {
    // toBeVisible fails on opacity: 0, which is how the rows were hidden in production.
    expect(await screen.findByText((content) => content.startsWith(name))).toBeVisible();
  }
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/history"), { headers: { Authorization: "Bearer test-token" } });
});
