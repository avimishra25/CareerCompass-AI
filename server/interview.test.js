const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { once } = require("node:events");
const express = require("express");
const jwt = require("jsonwebtoken");
const { extractProjectTitles, parseFeedback, validQuestions, mean } = require("./lib/interview");

const SCORES = { relevance: 8, technical_accuracy: 7, structure: 6, clarity: 8, depth: 6 };
const feedback = (overrides = {}) => ({
  scores: SCORES, overall: 9.9, strengths: ["Describes cache-aside"], improvements: ["Name the pattern"],
  model_answer_outline: "Pattern → key schema → TTL → invalidation", short_answer: false, ...overrides,
});
const flaskQuestions = (overrides = {}) => ({
  questions: ["project", "gap", "skill", "topic", "gap"].map((kind, index) => ({
    id: `q${index + 1}`, text: `Question ${index + 1}?`, type: "technical",
    targets: ["Expense Tracker", "redis", "react", "REST APIs", "docker"][index], target_kind: kind,
    ...(index === 0 ? overrides : {}),
  })),
});

test("project titles come from the Projects section only", () => {
  const text = [
    "Summary", "Student developer", "Projects", "Expense Tracker | React, Node, MongoDB",
    "• Built JWT authentication for 300 users.", "and deployed it on Render.", "Portfolio Website (2024)",
    "Weather App - JavaScript, OpenWeather API", "expense tracker", "Education", "Library System",
  ].join("\n");
  assert.equal(JSON.stringify(extractProjectTitles(text)), JSON.stringify(["Expense Tracker", "Portfolio Website", "Weather App"]));
  assert.equal(extractProjectTitles("No projects heading here").length, 0);
  assert.equal(extractProjectTitles(undefined).length, 0);
  const many = `Projects\n${Array.from({ length: 9 }, (_, i) => `Project ${i}`).join("\n")}`;
  assert.equal(extractProjectTitles(many).length, 5);
});

test("feedback is validated and the overall score is recomputed", () => {
  const clean = parseFeedback(feedback());
  assert.equal(clean.overall, 7);
  assert.equal(clean.modelAnswer, "Pattern → key schema → TTL → invalidation");
  assert.equal(parseFeedback(feedback({ scores: { ...SCORES, depth: 9 } })).overall, 7.6);
  assert.equal(parseFeedback(feedback({ short_answer: true, strengths: [], scores: Object.fromEntries(Object.keys(SCORES).map((k) => [k, 1])) })).overall, 1);
  for (const bad of [null, feedback({ scores: { ...SCORES, depth: 11 } }), feedback({ scores: { ...SCORES, depth: 6.5 } }),
    feedback({ scores: { ...SCORES, extra: 3 } }), feedback({ strengths: [] }), feedback({ improvements: ["a", "b", "c", "d"] }),
    feedback({ improvements: [" "] }), feedback({ model_answer_outline: "x".repeat(301) })]) {
    assert.equal(parseFeedback(bad), null, JSON.stringify(bad)?.slice(0, 80));
  }
  assert.equal(mean([7, 8.4]), 7.7);
  assert.equal(mean([]), null);
  assert.ok(validQuestions(flaskQuestions(), "technical", 5));
  for (const bad of [flaskQuestions({ id: "q9" }), flaskQuestions({ type: "hr" }), flaskQuestions({ target_kind: "other" }),
    flaskQuestions({ text: "x".repeat(301) }), { questions: flaskQuestions().questions.slice(0, 4) }, {}]) {
    assert.equal(validQuestions(bad, "technical", 5), false);
  }
  assert.ok(validQuestions(flaskQuestions({ type: "hr" }), "mixed", 5));
});

test("InterviewSession schema bounds scores, enums and question count", async () => {
  const InterviewSession = require("./models/InterviewSession");
  const question = { qid: "q1", text: "Why Redis?", type: "technical", targets: "redis", targetKind: "gap" };
  const session = new InterviewSession({ userId: "a".repeat(24), role: "fullstack developer", type: "mixed", difficulty: "advanced", questions: [question] });
  await session.validate();
  assert.equal(session.status, "active");
  assert.equal(session.overallScore, null);
  assert.equal(session.questions[0].answer, null);
  session.questions[0].overall = 11;
  await assert.rejects(session.validate());
  session.questions[0].overall = 7;
  session.difficulty = "expert";
  await assert.rejects(session.validate());
  session.difficulty = "advanced";
  session.questions[0].answer = "x".repeat(4001);
  await assert.rejects(session.validate());
  session.questions[0].answer = "ok";
  session.questions = Array.from({ length: 6 }, (_, i) => ({ ...question, qid: `q${i + 1}` }));
  await assert.rejects(session.validate());
});

test("Interview HTTP flow", async (t) => {
  const owner = "a".repeat(24), other = "b".repeat(24), analysisId = "c".repeat(24);
  const env = { JWT_SECRET: "test-only-secret", INTERNAL_API_KEY: "test-only-key" };
  const authModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "middleware/auth.js"), "utf8"), {
    module: authModule, process: { env },
    require: (name) => name === "../models/User" ? {
      findById: (id) => ({ select: async () => ({ _id: id, id }) }),
    } : require(name),
  });
  const analysis = {
    _id: analysisId, skills: ["react", "node", "mongodb"],
    resumeText: "Projects\nExpense Tracker | React, Node\n• Built JWT auth.\nPortfolio Website (2024)\nEducation\nB.Tech",
    match: new Map([["fullstack developer", { missing: ["redis", "docker", "React"] }]]),
  };
  const sessions = new Map();
  let app, nextId = 1, lastSelect, questionsCall, evaluateCall, calls = 0;
  let questionsResponse = () => ({ data: flaskQuestions() });
  let evaluateResponse = () => ({ data: feedback() });
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const ownerMatch = (filter) => {
    const doc = sessions.get(filter._id);
    return doc && doc.userId === filter.userId ? doc : null;
  };
  const wrappedExpress = () => {
    app = express();
    app.listen = () => {};
    return app;
  };
  wrappedExpress.json = express.json;
  const mocks = {
    dotenv: { config() {} }, express: wrappedExpress,
    mongoose: { connect: async () => {} },
    "./config/passport": { initialize: () => (req, res, next) => next() },
    "./routes/auth": express.Router(), "./middleware/auth": authModule.exports,
    "./models/Analysis": {
      findOne: (filter) => {
        const found = async () => filter.user === owner && (!filter._id || filter._id === analysisId) ? analysis : null;
        return { select: found, sort: () => ({ select: found }) };
      },
    },
    "./models/InterviewSession": {
      create: async (data) => {
        const doc = copy(data);
        doc._id = String(nextId++).padStart(24, "0");
        doc.status = "active";
        doc.overallScore = null;
        doc.questions = doc.questions.map((item) => ({ ...item, answer: null, scores: null, overall: null, answeredAt: null }));
        sessions.set(doc._id, doc);
        return doc;
      },
      find: (filter) => {
        const chain = {
          select: (fields) => { lastSelect = fields; return chain; },
          sort: () => chain, limit: () => chain,
          lean: async () => [...sessions.values()].filter((doc) => doc.userId === filter.userId).map(copy),
        };
        return chain;
      },
      findOne: (filter) => ({ lean: async () => { const doc = ownerMatch(filter); return doc ? copy(doc) : null; } }),
      findOneAndUpdate: (filter, update) => ({ lean: async () => {
        const doc = ownerMatch(filter);
        if (!doc) return null;
        if (filter.questions) {
          const item = doc.questions.find((q) => q.qid === filter.questions.$elemMatch.qid && q.answeredAt === null);
          if (!item) return null;
          for (const [key, value] of Object.entries(update.$set)) item[key.replace("questions.$.", "")] = value;
        } else {
          Object.assign(doc, update.$set);
        }
        return copy(doc);
      } }),
    },
    axios: { post: async (url, payload, options) => {
      calls++;
      if (url.endsWith("/interview/questions")) { questionsCall = { url, payload, options }; return questionsResponse(); }
      evaluateCall = { url, payload, options };
      return evaluateResponse();
    } },
  };
  const originalDirectory = process.cwd();
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "careercompass-interview-")));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "server.js"), "utf8"), {
    require: (name) => mocks[name] || require(name), process: { env },
    console: { log() {}, error() {} }, Buffer,
  });
  const server = express.application.listen.call(app, 0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const token = (user) => `Bearer ${jwt.sign({ id: user }, env.JWT_SECRET)}`;
  const request = (method, suffix, body, user = owner) => fetch(`${origin}/api/interview${suffix}`, {
    method, headers: { "Content-Type": "application/json", ...(user ? { Authorization: token(user) } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const start = { role: "fullstack developer", type: "technical", difficulty: "intermediate" };
  const longAnswer = "I would check Redis first with a key from the query parameters and fall back to MongoDB on a miss.";
  let sessionId;
  try {
    await t.test("JWT required on every route", async () => {
      const id = "0".repeat(24);
      for (const [method, suffix, body] of [["POST", "/start", start], ["GET", "/history"], ["GET", `/${id}`],
        ["POST", `/${id}/answer`, { qid: "q1", answer: longAnswer }]]) {
        assert.equal((await request(method, suffix, body, null)).status, 401);
      }
    });

    await t.test("start rejects invalid input and foreign analyses before calling Flask", async () => {
      for (const body of [{}, [], { ...start, role: "astronaut" }, { ...start, type: "coding" }, { ...start, difficulty: "expert" },
        { ...start, analysisId: "bad" }, { ...start, userId: other }, { ...start, count: 10 }]) {
        // A separate user keeps these requests out of the owner's 10-session limit.
        assert.equal((await request("POST", "/start", body, "9".repeat(24))).status, 400, JSON.stringify(body));
      }
      assert.equal((await request("POST", "/start", { ...start, analysisId }, other)).status, 404);
      assert.equal(calls, 0);
    });

    await t.test("start builds skills, gaps and projects from the owner's latest analysis", async () => {
      const response = await request("POST", "/start", start);
      assert.equal(response.status, 201);
      const session = await response.json();
      sessionId = session._id;
      assert.equal(questionsCall.options.headers["X-Internal-Key"], env.INTERNAL_API_KEY);
      // "React" is a known skill, so it is not sent as a gap.
      assert.equal(JSON.stringify(questionsCall.payload), JSON.stringify({
        role: "fullstack developer", type: "technical", difficulty: "intermediate",
        resume_skills: ["react", "node", "mongodb"], gaps: ["redis", "docker"],
        projects: ["Expense Tracker", "Portfolio Website"], count: 5,
      }));
      assert.equal(session.userId, owner);
      assert.equal(session.analysisId, analysisId);
      assert.equal(session.questions.length, 5);
      assert.equal(JSON.stringify(session.questions[1]), JSON.stringify({
        qid: "q2", text: "Question 2?", type: "technical", targets: "redis", targetKind: "gap",
        answer: null, scores: null, overall: null, answeredAt: null,
      }));

      // Without any analysis the session still starts, with empty context.
      assert.equal((await request("POST", "/start", { ...start, type: "mixed" }, other)).status, 201);
      assert.equal(JSON.stringify([questionsCall.payload.resume_skills, questionsCall.payload.gaps, questionsCall.payload.projects]), "[[],[],[]]");
      assert.equal((await request("POST", "/start", { ...start, analysisId })).status, 201);
    });

    await t.test("invalid or failing question generation returns safe JSON", async () => {
      questionsResponse = () => ({ data: flaskQuestions({ type: "hr" }) });
      let response = await request("POST", "/start", start, "3".repeat(24));
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: "Interview questions unavailable" });
      questionsResponse = () => { throw { response: { status: 502, data: { error: "AI returned invalid questions. Try again." } } }; };
      response = await request("POST", "/start", start, "3".repeat(24));
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { error: "AI returned invalid questions. Try again." });
      questionsResponse = () => { throw { response: { status: 500, data: { error: "private traceback" } } }; };
      response = await request("POST", "/start", start, "3".repeat(24));
      assert.equal(response.status, 503);
      assert.doesNotMatch(await response.text(), /private/);
      questionsResponse = () => ({ data: flaskQuestions() });
    });

    await t.test("answer validates input and ownership before calling Flask", async () => {
      const before = calls;
      for (const [suffix, body] of [["/bad/answer", { qid: "q1", answer: longAnswer }], [`/${sessionId}/answer`, {}],
        [`/${sessionId}/answer`, { qid: "q1" }], [`/${sessionId}/answer`, { qid: "q1", answer: 5 }],
        [`/${sessionId}/answer`, { qid: "1", answer: longAnswer }], [`/${sessionId}/answer`, { qid: "q1", answer: "x", extra: 1 }],
        [`/${sessionId}/answer`, []]]) {
        assert.equal((await request("POST", suffix, body)).status, 400, JSON.stringify(body));
      }
      assert.equal((await request("POST", `/${sessionId}/answer`, { qid: "q1", answer: "😀".repeat(4001) })).status, 413);
      assert.equal((await request("POST", `/${sessionId}/answer`, { qid: "q1", answer: longAnswer }, other)).status, 404);
      assert.equal((await request("POST", `/${"0".repeat(24)}/answer`, { qid: "q1", answer: longAnswer })).status, 404);
      assert.equal((await request("POST", `/${sessionId}/answer`, { qid: "q9", answer: longAnswer })).status, 404);
      assert.equal(calls, before);
    });

    await t.test("answer stores recomputed feedback and blocks re-answering", async () => {
      const response = await request("POST", `/${sessionId}/answer`, { qid: "q2", answer: `  ${longAnswer}  ` });
      assert.equal(response.status, 200);
      assert.equal(JSON.stringify(evaluateCall.payload), JSON.stringify({
        question: "Question 2?", type: "technical", role: "fullstack developer", answer: longAnswer,
      }));
      const session = await response.json();
      const answered = session.questions[1];
      assert.equal(answered.answer, longAnswer);
      assert.equal(answered.overall, 7, "Flask/LLM overall of 9.9 is ignored");
      assert.equal(JSON.stringify(answered.scores), JSON.stringify(SCORES));
      assert.equal(answered.modelAnswer, "Pattern → key schema → TTL → invalidation");
      assert.ok(answered.answeredAt);
      assert.equal(session.overallScore, 7);
      assert.equal(session.status, "active");
      assert.equal((await request("POST", `/${sessionId}/answer`, { qid: "q2", answer: longAnswer })).status, 409);

      const before = sessions.get(sessionId).questions[2].answeredAt;
      evaluateResponse = () => ({ data: { ...feedback(), scores: { ...SCORES, depth: 11 } } });
      const invalid = await request("POST", `/${sessionId}/answer`, { qid: "q3", answer: longAnswer });
      assert.equal(invalid.status, 503);
      assert.deepEqual(await invalid.json(), { error: "Answer evaluation unavailable" });
      assert.equal(sessions.get(sessionId).questions[2].answeredAt, before);
    });

    await t.test("session completes when every question is answered", async () => {
      const short = Object.fromEntries(Object.keys(SCORES).map((key) => [key, 1]));
      evaluateResponse = () => ({ data: feedback({ scores: short, overall: 1, strengths: [], short_answer: true }) });
      let session;
      for (const qid of ["q1", "q3", "q4"]) {
        session = await (await request("POST", `/${sessionId}/answer`, { qid, answer: "" })).json();
        assert.equal(session.status, "active");
      }
      assert.equal(session.questions[0].shortAnswer, true);
      evaluateResponse = () => ({ data: feedback({ scores: Object.fromEntries(Object.keys(SCORES).map((key) => [key, 9])) }) });
      const response = await request("POST", `/${sessionId}/answer`, { qid: "q5", answer: longAnswer });
      session = await response.json();
      assert.equal(session.status, "completed");
      assert.equal(session.overallScore, 3.8); // mean of 7, 1, 1, 1, 9
      assert.equal((await request("POST", `/${sessionId}/answer`, { qid: "q5", answer: longAnswer })).status, 409);
    });

    await t.test("GET session and history are owner scoped; history has no answers", async () => {
      const response = await request("GET", `/${sessionId}`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).questions[1].answer, longAnswer);
      assert.equal((await request("GET", `/${sessionId}`, undefined, other)).status, 404);
      assert.equal((await request("GET", "/bad-id")).status, 400);
      const history = await (await request("GET", "/history")).json();
      assert.ok(history.every((item) => item.userId === owner));
      assert.ok(history.length >= 2);
      assert.doesNotMatch(lastSelect, /answer\b|strengths|improvements|modelAnswer|text/);
      assert.match(lastSelect, /overallScore/);
      assert.equal((await (await request("GET", "/history", undefined, "4".repeat(24))).json()).length, 0);
    });

    await t.test("starting sessions is limited per user", async () => {
      let response;
      for (let i = 0; i < 11; i++) {
        response = await request("POST", "/start", start, "1".repeat(24));
        if (response.status === 429) break;
      }
      assert.equal(response.status, 429);
      assert.ok((await response.json()).error);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    process.chdir(originalDirectory);
  }
});
