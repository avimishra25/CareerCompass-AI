import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import ResumeBuilder from "./ResumeBuilder";
import { exportResumePdf } from "../utils/resumePdf";

jest.mock("axios");
jest.mock("../utils/resumePdf", () => ({ exportResumePdf: jest.fn() }));

const suggestion = ["Built a responsive portfolio website with HTML and CSS", "Added a contact form used by 300 visitors"];

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("token", "test-token");
  axios.get.mockResolvedValue({ data: [] });
  axios.post.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/enhance")
    ? { bullets: suggestion }
    : { atsScore: 64, atsBreakdown: { verbs: { score: 4, max: 20, label: "Action verbs" } }, mlInsights: null } }));
});

test("enhance project notes, accept the suggestion, and see it in the preview", async () => {
  render(<ResumeBuilder />);
  fireEvent.click(await screen.findByRole("button", { name: "Projects" }));
  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Portfolio Website" } });
  fireEvent.change(screen.getByLabelText("Your notes"), {
    target: { value: "made a portfolio site with html and css, contact form, 300 visitors" },
  });
  fireEvent.change(screen.getByLabelText("Tone"), { target: { value: "concise" } });
  fireEvent.click(screen.getByRole("button", { name: "✨ Enhance with AI" }));

  const card = await screen.findByRole("region", { name: "AI suggestion" });
  expect(within(card).getByText(suggestion[0])).toBeInTheDocument();
  expect(within(card).getByText(/AI only rephrases what you wrote/)).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/resume-builder/enhance"), {
    section: "project", title: "Portfolio Website", tone: "concise",
    notes: "made a portfolio site with html and css, contact form, 300 visitors",
  }, { headers: { Authorization: "Bearer test-token" } });

  fireEvent.click(within(card).getByRole("button", { name: "✓ Accept" }));
  expect(screen.queryByRole("region", { name: "AI suggestion" })).not.toBeInTheDocument();
  const preview = screen.getByRole("region", { name: "Resume preview" });
  for (const bullet of suggestion) {
    expect(within(preview).getByText(bullet)).toHaveAttribute("data-highlighted", "true");
  }
  expect(screen.getByLabelText(/^Bullets/)).toHaveValue(suggestion.join("\n"));
  expect(screen.getByRole("button", { name: "Projects ✎" })).toBeInTheDocument();

  // The debounced live score picks up the accepted bullets.
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/resume-builder/score"),
    { text: expect.stringContaining(suggestion[1]) }, expect.anything()), { timeout: 3000 });
  expect(await screen.findByRole("img", { name: "ATS score 64 out of 100" })).toBeInTheDocument();
});

test("after export, 'Analyze this resume' hands the same PDF to Analyze; editing hides it", async () => {
  const pdf = new File(["%PDF-1.3"], "Test_User_Resume.pdf", { type: "application/pdf" });
  exportResumePdf.mockResolvedValue(pdf);
  const onNavigate = jest.fn();
  render(<ResumeBuilder onNavigate={onNavigate} />);
  fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "Test User" } });
  expect(screen.queryByRole("button", { name: "Analyze this resume →" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "⬇ Export PDF" }));
  fireEvent.click(await screen.findByRole("button", { name: "Analyze this resume →" }));
  expect(exportResumePdf).toHaveBeenCalledTimes(1);
  expect(onNavigate).toHaveBeenCalledWith("analyze", { file: pdf });
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test User 2" } });
  expect(screen.queryByRole("button", { name: "Analyze this resume →" })).not.toBeInTheDocument();
});

test("edited suggestion is what gets accepted; API errors are shown", async () => {
  render(<ResumeBuilder />);
  fireEvent.click(await screen.findByRole("button", { name: "Experience" }));
  fireEvent.change(screen.getByLabelText("Your notes"), { target: { value: "helped build apis" } });
  fireEvent.click(screen.getByRole("button", { name: "✨ Enhance with AI" }));
  const card = await screen.findByRole("region", { name: "AI suggestion" });
  fireEvent.click(within(card).getByRole("button", { name: "Edit" }));
  fireEvent.change(within(card).getByLabelText("Edit suggestion"), { target: { value: "Built REST APIs in Express\n\n" } });
  fireEvent.click(within(card).getByRole("button", { name: "✓ Accept" }));
  expect(within(screen.getByRole("region", { name: "Resume preview" })).getByText("Built REST APIs in Express")).toBeInTheDocument();

  axios.post.mockRejectedValue({ response: { data: { error: "AI returned an invalid suggestion. Try again." } } });
  fireEvent.click(screen.getByRole("button", { name: "✨ Enhance with AI" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("AI returned an invalid suggestion. Try again.");
});
