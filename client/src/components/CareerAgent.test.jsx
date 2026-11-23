import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import CareerAgent from "./CareerAgent";

jest.mock("axios");

beforeEach(() => {
  jest.clearAllMocks();
  Element.prototype.scrollIntoView = jest.fn();
  localStorage.setItem("token", "test-token");
  axios.get.mockRejectedValue(new Error("no summary in this test"));
});

test("context includes the roadmap's next milestone and the last interview score", async () => {
  axios.get.mockResolvedValue({ data: {
    roadmap: { targetRole: "devops engineer", completion: 50, nextMilestone: { week: 3, skill: "kubernetes", objective: "Pods", status: "progress" } },
    interview: { readiness: 7.6, sessions: 5, change: null, lastScore: 8.2 },
  } });
  axios.post.mockResolvedValue({ data: { reply: "Focus on kubernetes." } });
  render(<CareerAgent skills={["docker"]} atsScore={70} bestRole={{ role: "devops engineer" }} />);
  fireEvent.click(screen.getByTitle("AI Career Coach"));
  expect(await screen.findByText("Next: kubernetes")).toBeInTheDocument();
  expect(screen.getByText("Interview 8.2/10")).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/dashboard/summary"), { headers: { Authorization: "Bearer test-token" } });

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "What next?" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  await screen.findByText("Focus on kubernetes.");
  const context = axios.post.mock.calls[0][1].history.filter((item) => item.content.startsWith("Resume analysis context"));
  const parsed = JSON.parse(context.map((item) => item.content.split("\n").slice(1).join("\n")).join(""));
  expect(parsed.careerProgress).toEqual({
    roadmap: { targetRole: "devops engineer", completion: 50, nextMilestone: { week: 3, skill: "kubernetes", objective: "Pods" } },
    lastInterviewScore: 8.2, interviewReadiness: 7.6,
  });
});

test("the coach still works when the summary cannot load", async () => {
  axios.post.mockResolvedValue({ data: { reply: "Sure." } });
  render(<CareerAgent skills={["docker"]} />);
  fireEvent.click(screen.getByTitle("AI Career Coach"));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hi" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  await screen.findByText("Sure.");
  const context = axios.post.mock.calls[0][1].history.filter((item) => item.content.startsWith("Resume analysis context"));
  expect(JSON.parse(context.map((item) => item.content.split("\n").slice(1).join("\n")).join("")).careerProgress).toBeNull();
});

test("preserves ML insights and all turns, including long assistant replies", async () => {
  const reply = "Advice ".repeat(400);
  axios.post.mockResolvedValue({ data: { reply } });
  const mlInsights = { improve_here: [{ tip: "Quantify achievements" }], detail: "Insight ".repeat(500) };
  render(<CareerAgent skills={["python"]} atsScore={72} bestRole={{ role: "data scientist" }} mlInsights={mlInsights} />);
  fireEvent.click(screen.getByTitle("AI Career Coach"));
  const input = screen.getByPlaceholderText("Ask about your gaps, roadmap, ATS…");
  for (let i = 0; i < 7; i++) {
    fireEvent.change(input, { target: { value: i === 0 ? "My target is data scientist" : `Follow-up ${i}` } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getAllByText(reply.trim())).toHaveLength(i + 1));
  }
  const payload = axios.post.mock.calls[6][1];
  const context = payload.history.filter((item) => item.content.startsWith("Resume analysis context"));
  const reconstructed = context.map((item) => item.content.split("\n").slice(1).join("\n")).join("");
  expect(JSON.parse(reconstructed).mlInsights).toEqual(mlInsights);
  expect(context.every((item) => [...item.content].length <= 2000)).toBe(true);
  expect(payload.history.slice(context.length)).toHaveLength(12);
  expect(payload.history[context.length]).toEqual({ role: "user", content: "My target is data scientist" });
  expect(payload.history[context.length + 1]).toEqual({ role: "assistant", content: reply });
  expect(payload.message).toBe("Follow-up 6");
});

test("shows a safe provider configuration error", async () => {
  const error = "AI request rejected. Check GEMINI_API_KEY and GEMINI_MODEL configuration.";
  axios.post.mockRejectedValue({ response: { status: 503, data: { error } } });
  render(<CareerAgent />);
  fireEvent.click(screen.getByTitle("AI Career Coach"));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Help me" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(await screen.findByRole("alert")).toHaveTextContent(error);
});
