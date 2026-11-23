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

const contextOf = (call) => call[1].history.filter((item) => item.content.startsWith("Resume analysis context"));
const parseContext = (chunks) => JSON.parse(chunks.map((item) => item.content.split("\n").slice(1).join("\n")).join(""));

test("context includes the roadmap's next milestone and the last interview score", async () => {
  axios.get.mockResolvedValue({ data: {
    roadmap: { targetRole: "devops engineer", completion: 50, nextMilestone: { week: 3, skill: "kubernetes", objective: "Pods", status: "progress" } },
    interview: { readiness: 7.6, sessions: 5, change: null, lastScore: 8.2 },
  } });
  axios.post.mockResolvedValue({ data: { reply: "Focus on kubernetes." } });
  render(<CareerAgent open skills={["docker"]} atsScore={70} bestRole={{ role: "devops engineer" }} />);
  expect(screen.getByRole("complementary", { name: "Career coach" })).toBeVisible();
  expect(await screen.findByText("Next: Kubernetes")).toBeInTheDocument();
  expect(screen.getByText("Interview 8.2/10")).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/dashboard/summary"), { headers: { Authorization: "Bearer test-token" } });

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "What next?" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  await screen.findByText("Focus on kubernetes.");
  expect(parseContext(contextOf(axios.post.mock.calls[0])).careerProgress).toEqual({
    roadmap: { targetRole: "devops engineer", completion: 50, nextMilestone: { week: 3, skill: "kubernetes", objective: "Pods" } },
    lastInterviewScore: 8.2, interviewReadiness: 7.6,
  });
});

test("the coach still works when the summary cannot load", async () => {
  axios.post.mockResolvedValue({ data: { reply: "Sure." } });
  render(<CareerAgent open skills={["docker"]} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hi" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  await screen.findByText("Sure.");
  expect(parseContext(contextOf(axios.post.mock.calls[0])).careerProgress).toBeNull();
});

test("preserves ML insights and all turns, including long assistant replies", async () => {
  const reply = "Advice ".repeat(400);
  axios.post.mockResolvedValue({ data: { reply } });
  const mlInsights = { improve_here: [{ tip: "Quantify achievements" }], detail: "Insight ".repeat(500) };
  render(<CareerAgent open skills={["python"]} atsScore={72} bestRole={{ role: "data scientist" }} mlInsights={mlInsights} />);
  const input = screen.getByPlaceholderText("Ask about your skill gaps, roadmap or ATS score");
  for (let i = 0; i < 7; i++) {
    fireEvent.change(input, { target: { value: i === 0 ? "My target is data scientist" : `Follow-up ${i}` } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getAllByText(reply.trim())).toHaveLength(i + 1));
  }
  const payload = axios.post.mock.calls[6][1];
  const context = contextOf(axios.post.mock.calls[6]);
  expect(parseContext(context).mlInsights).toEqual(mlInsights);
  expect(context.every((item) => [...item.content].length <= 2000)).toBe(true);
  expect(payload.history.slice(context.length)).toHaveLength(12);
  expect(payload.history[context.length]).toEqual({ role: "user", content: "My target is data scientist" });
  expect(payload.history[context.length + 1]).toEqual({ role: "assistant", content: reply });
  expect(payload.message).toBe("Follow-up 6");
});

test("shows a safe provider error inline and never sends it back as an assistant turn", async () => {
  const error = "AI request rejected. Check GEMINI_API_KEY and GEMINI_MODEL configuration.";
  axios.post.mockRejectedValueOnce({ response: { status: 503, data: { error } } });
  render(<CareerAgent open />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Help me" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(await screen.findByRole("alert")).toHaveTextContent(error);
  axios.post.mockResolvedValueOnce({ data: { reply: "Here is help." } });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Try again" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  await screen.findByText("Here is help.");
  const turns = axios.post.mock.calls[1][1].history.slice(contextOf(axios.post.mock.calls[1]).length);
  expect(turns).toEqual([{ role: "user", content: "Help me" }]);
});

test("model replies are escaped before formatting; Esc and the close button call onClose", async () => {
  axios.post.mockResolvedValue({ data: { reply: "**Bold** <img src=x onerror=alert(1)>" } });
  const onClose = jest.fn();
  const { container } = render(<CareerAgent open onClose={onClose} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hi" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(await screen.findByText("Bold")).toContainHTML("<strong>Bold</strong>");
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Close career coach" }));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test("hidden while closed, but the conversation is kept", () => {
  const { rerender } = render(<CareerAgent open={false} />);
  expect(screen.queryByRole("complementary", { name: "Career coach" })).not.toBeInTheDocument();
  rerender(<CareerAgent open />);
  expect(screen.getByRole("complementary", { name: "Career coach" })).toBeVisible();
});
