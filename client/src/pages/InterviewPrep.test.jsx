import { fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import InterviewPrep from "./InterviewPrep";

jest.mock("axios");

const question = (qid, text, extra = {}) => ({
  qid, text, type: "technical", targets: "react", targetKind: "skill", answer: null, scores: null,
  overall: null, strengths: [], improvements: [], modelAnswer: null, shortAnswer: false, answeredAt: null, ...extra,
});
const session = {
  _id: "s1", role: "fullstack developer", type: "technical", difficulty: "intermediate", status: "active", overallScore: 8,
  questions: [
    question("q1", "Explain how JWT authentication works in your Expense Tracker project.", {
      targets: "Expense Tracker", targetKind: "project", answer: "Earlier answer", overall: 8, answeredAt: "2026-11-20",
      scores: { relevance: 8, technical_accuracy: 8, structure: 8, clarity: 8, depth: 8 },
      strengths: ["Clear"], improvements: ["Add an example"], modelAnswer: "Token → verify → expiry",
    }),
    question("q2", "How would you cache a slow MongoDB query with Redis?", { targets: "redis", targetKind: "gap" }),
    question("q3", "REST vs GraphQL: when would you choose each?", { targets: "REST APIs", targetKind: "topic" }),
    question("q4", "How do React hooks manage state?"),
    question("q5", "How would you deploy a MERN app with Docker?", { targets: "docker", targetKind: "gap" }),
  ],
};
const answer = "I would check Redis first using a key built from the query parameters, fall back to MongoDB on a miss, "
  + "store the result with a TTL and delete the key when the data changes.";
const feedback = {
  answer, overall: 7, answeredAt: "2026-11-23", shortAnswer: false,
  scores: { relevance: 8, technical_accuracy: 7, structure: 6, clarity: 8, depth: 6 },
  strengths: ["Correctly describes the cache-aside pattern.", "Mentions TTL and invalidation on write."],
  improvements: ["Name the pattern explicitly (cache-aside).", "Discuss cache stampede."],
  modelAnswer: "Pattern → key schema → TTL choice → invalidation on update/delete → metrics.",
};
// Five recent sessions averaging 8.0 and one older session at 6.0.
const history = [8, 8, 8, 8, 8, 6].map((score, index) => ({
  _id: index ? `old${index}` : "s1", role: "fullstack developer", status: index ? "completed" : "active",
  overallScore: score, questions: [],
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("token", "test-token");
  axios.get.mockImplementation((url) => Promise.resolve({ data:
    url.endsWith("/api/interview/history") ? history : url.endsWith("/api/interview/s1") ? session : [] }));
  axios.post.mockResolvedValue({ data: { ...session, overallScore: 7.5, questions: session.questions.map((item) =>
    item.qid === "q2" ? { ...item, ...feedback } : item) } });
});

test("a JD cross-link focuses the next session instead of resuming the active one", async () => {
  axios.post.mockResolvedValue({ data: { ...session, _id: "s2" } });
  render(<InterviewPrep onNavigate={jest.fn()} preset={{ jdMatchId: "jd1", jdTitle: "Platform intern" }} />);
  expect(screen.getByText(/targets the job “Platform intern”/)).toBeInTheDocument();
  await screen.findByRole("region", { name: "Interview readiness" });
  expect(screen.queryByRole("article", { name: "Current question" })).not.toBeInTheDocument();
  expect(axios.get).not.toHaveBeenCalledWith(expect.stringContaining("/api/interview/s1"), expect.anything());
  fireEvent.click(screen.getByRole("button", { name: "Start new session" }));
  expect(await screen.findByRole("article", { name: "Current question" })).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/interview/start"),
    { role: "fullstack developer", type: "mixed", difficulty: "intermediate", jdMatchId: "jd1" },
    { headers: { Authorization: "Bearer test-token" } });
  expect(screen.queryByText(/targets the job/)).not.toBeInTheDocument();
});

test("submitting an answer shows the score ring, rubric bars, feedback and next question", async () => {
  render(<InterviewPrep onNavigate={jest.fn()} />);

  // Resumes the active session at the first unanswered question.
  const card = await screen.findByRole("article", { name: "Current question" });
  expect(within(card).getByText("Question 2 of 5 · Technical")).toBeInTheDocument();
  expect(within(card).getByText("targets gap: redis")).toBeInTheDocument();
  const readiness = screen.getByRole("region", { name: "Interview readiness" });
  expect(within(readiness).getByText("8.0")).toBeInTheDocument();
  expect(within(readiness).getByText(/▲ 2\.0 vs previous 5/)).toBeInTheDocument();
  // jsdom has no Web Speech API, so the voice button is hidden.
  expect(screen.queryByRole("button", { name: /Answer by voice/ })).not.toBeInTheDocument();

  fireEvent.change(within(card).getByLabelText("Your answer"), { target: { value: answer } });
  fireEvent.click(within(card).getByRole("button", { name: "Submit answer" }));

  const panel = await screen.findByRole("region", { name: "AI feedback" });
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/interview/s1/answer"),
    { qid: "q2", answer }, { headers: { Authorization: "Bearer test-token" } });
  expect(within(panel).getByRole("img", { name: "Score 7.0 out of 10" })).toBeInTheDocument();
  expect(within(panel).getByText("Good answer")).toBeInTheDocument();
  const bars = within(panel).getAllByRole("progressbar");
  expect(bars.map((bar) => [bar.getAttribute("aria-label"), bar.getAttribute("aria-valuenow")])).toEqual([
    ["Relevance", "8"], ["Technical accuracy", "7"], ["Structure", "6"], ["Clarity", "8"], ["Depth", "6"],
  ]);
  expect(within(within(panel).getByRole("list", { name: "Strengths" })).getAllByRole("listitem")).toHaveLength(2);
  expect(within(panel).getByText("Discuss cache stampede.")).toBeInTheDocument();
  expect(within(panel).getByText(feedback.modelAnswer)).toBeInTheDocument();
  expect(within(card).getByText(answer)).toBeInTheDocument();
  expect(within(screen.getByRole("navigation", { name: "Session questions" })).getByText("7.0")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Next question →" }));
  expect(screen.getByText("Question 3 of 5 · Technical")).toBeInTheDocument();
  expect(screen.getByText("topic: REST APIs")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "AI feedback" })).not.toBeInTheDocument();
});
