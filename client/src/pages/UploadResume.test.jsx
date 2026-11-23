import { fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import UploadResume from "./UploadResume";

jest.mock("axios");
// The report's PDF export and the chat widget are covered elsewhere.
jest.mock("../components/CareerAgent", () => () => null);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("token", "test-token");
});

test("a builder PDF is pre-attached; the ATS report links to roadmap and interview with this analysis and role", async () => {
  axios.post.mockResolvedValue({ data: {
    analysisId: "new-analysis", skills: ["python", "docker"], match: { "backend developer": { score: "70", missing: ["redis"], emoji: "⚙️" } },
    bestRole: { role: "backend developer", score: 70 }, atsScore: 66, atsBreakdown: {}, targetRoleAnalysis: null, mlInsights: null,
  } });
  const onNavigate = jest.fn();
  const file = new File(["%PDF-1.4"], "Test_User_Resume.pdf", { type: "application/pdf" });
  render(<UploadResume onNavigate={onNavigate} presetFile={file} />);
  expect(screen.getByText("Test_User_Resume.pdf")).toBeInTheDocument();
  expect(screen.getByText(/Your Resume Builder PDF is attached/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Analyze Resume →" }));
  const steps = await screen.findByRole("group", { name: "Next steps" });
  expect(axios.post.mock.calls[0][1].get("resume")).toBe(file);
  // Kept out of the html2canvas PDF report.
  expect(steps).toHaveAttribute("data-html2canvas-ignore", "true");
  fireEvent.click(within(steps).getByRole("button", { name: "🗺️ Build my roadmap" }));
  expect(onNavigate).toHaveBeenLastCalledWith("roadmap", { analysisId: "new-analysis", targetRole: "backend developer" });
  fireEvent.click(within(steps).getByRole("button", { name: "🎤 Practise interview" }));
  expect(onNavigate).toHaveBeenLastCalledWith("interview", { analysisId: "new-analysis", role: "backend developer" });
});
