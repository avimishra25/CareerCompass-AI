const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { once } = require("node:events");
const express = require("express");
const jwt = require("jsonwebtoken");
const { readiness } = require("./lib/interview");

test("readiness averages the latest 5 sessions and compares with the 5 before", () => {
  assert.equal(readiness([]), null);
  assert.equal(JSON.stringify(readiness([7])), JSON.stringify({ score: 7, sessions: 1, change: null }));
  assert.equal(JSON.stringify(readiness([8, 7, 9, 6, 8, 5, 5, 4, 6, 5, 1])), JSON.stringify({ score: 7.6, sessions: 5, change: 2.6 }));
});

test("GET /api/dashboard/summary", async (t) => {
  const owner = "a".repeat(24), empty = "b".repeat(24), broken = "c".repeat(24);
  const env = { JWT_SECRET: "test-only-secret", INTERNAL_API_KEY: "test-only-key" };
  const authModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "middleware/auth.js"), "utf8"), {
    module: authModule, process: { env },
    require: (name) => name === "../models/User" ? { findById: (id) => ({ select: async () => ({ _id: id, id }) }) } : require(name),
  });
  const filters = {};
  // Records are owned by `owner`; a query returns them only when its filter is scoped to that user.
  const data = {
    Analysis: [
      { _id: "1".repeat(24), atsScore: 70, bestRole: { role: "backend developer" }, createdAt: "2026-11-20T10:00:00.000Z" },
      { _id: "2".repeat(24), atsScore: null, bestRole: { role: "fullstack developer" } },
      { _id: "3".repeat(24), atsScore: 50, bestRole: { role: "fullstack developer" } },
      { _id: "4".repeat(24), atsScore: 61, bestRole: { role: "backend developer" } },
    ],
    JDMatch: [{ result: { overall_match: 40 } }, { result: { overall_match: 72 } }, { result: { overall_match: 65 } }],
    CareerRoadmap: {
      _id: "5".repeat(24), targetRole: "devops engineer", covered: false,
      milestones: [
        { week: 4, skill: "kubernetes", objective: "Deploy to a cluster", status: "todo" },
        { week: 1, skill: "docker", objective: "Images", status: "done" },
        { week: 3, skill: "kubernetes", objective: "Pods and services", status: "progress" },
        { week: 2, skill: "docker", objective: "Compose", status: "done" },
      ],
    },
    InterviewSession: [8, 7, 9, 6, 8, 5, 5].map((overallScore) => ({ overallScore })),
  };
  const query = (model, filter, result) => {
    filters[model] = filter;
    const chain = {
      select: () => chain, sort: () => chain, limit: () => chain,
      lean: async () => {
        const user = String(filter.user || filter.userId);
        if (user === broken) throw new Error("private database detail");
        return user === owner ? result : Array.isArray(result) ? [] : null;
      },
    };
    return chain;
  };
  let app;
  const wrappedExpress = () => {
    app = express();
    app.listen = () => {};
    return app;
  };
  wrappedExpress.json = express.json;
  const mocks = {
    dotenv: { config() {} }, express: wrappedExpress, mongoose: { connect: async () => {} },
    "./config/passport": { initialize: () => (req, res, next) => next() },
    "./routes/auth": express.Router(), "./middleware/auth": authModule.exports,
    "./models/Analysis": { find: (filter) => query("Analysis", filter, data.Analysis) },
    "./models/JDMatch": { find: (filter) => query("JDMatch", filter, data.JDMatch) },
    "./models/CareerRoadmap": { findOne: (filter) => query("CareerRoadmap", filter, data.CareerRoadmap) },
    "./models/InterviewSession": { find: (filter) => query("InterviewSession", filter, data.InterviewSession) },
    axios: { post: async () => assert.fail("summary must not call Flask"), get: async () => assert.fail("summary must not call Flask") },
  };
  const originalDirectory = process.cwd();
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "careercompass-dashboard-")));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "server.js"), "utf8"), {
    require: (name) => mocks[name] || require(name), process: { env },
    console: { log() {}, error() {} }, Buffer,
  });
  const server = express.application.listen.call(app, 0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const get = (user) => fetch(`${origin}/api/dashboard/summary`, user ? { headers: { Authorization: `Bearer ${jwt.sign({ id: user }, env.JWT_SECRET)}` } } : {});
  try {
    await t.test("requires a JWT", async () => {
      assert.equal((await get(null)).status, 401);
    });

    await t.test("returns every dashboard number in one owner-scoped response", async () => {
      const response = await get(owner);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        analyses: {
          count: 4, averageAts: 60, latestAts: 70, topRole: "backend developer",
          latestAnalysisId: "1".repeat(24), latestAnalysisAt: "2026-11-20T10:00:00.000Z",
        },
        jdMatches: { count: 3, best: 72 },
        roadmap: {
          id: "5".repeat(24), targetRole: "devops engineer", covered: false, total: 4, done: 2, completion: 50,
          nextMilestone: { week: 3, skill: "kubernetes", objective: "Pods and services", status: "progress" },
        },
        interview: { readiness: 7.6, sessions: 5, change: 2.6, lastScore: 8 },
      });
      assert.equal(filters.Analysis.user, owner);
      assert.equal(filters.JDMatch.userId, owner);
      assert.equal(filters.CareerRoadmap.userId, owner);
      assert.equal(filters.InterviewSession.userId, owner);
      assert.equal(JSON.stringify(filters.InterviewSession.overallScore), JSON.stringify({ $ne: null }));
    });

    await t.test("a user with no data gets zeros and nulls, never someone else's records", async () => {
      assert.deepEqual(await (await get(empty)).json(), {
        analyses: { count: 0, averageAts: null, latestAts: null, topRole: null, latestAnalysisId: null, latestAnalysisAt: null },
        jdMatches: { count: 0, best: null },
        roadmap: null,
        interview: null,
      });
    });

    await t.test("a covered roadmap counts as complete; finished roadmaps have no next milestone", async () => {
      const saved = data.CareerRoadmap;
      data.CareerRoadmap = { _id: saved._id, targetRole: "frontend developer", covered: true, milestones: [] };
      let body = await (await get(owner)).json();
      assert.equal(body.roadmap.completion, 100);
      assert.equal(body.roadmap.nextMilestone, null);
      data.CareerRoadmap = { ...saved, milestones: saved.milestones.map((item) => ({ ...item, status: "done" })) };
      body = await (await get(owner)).json();
      assert.equal(body.roadmap.completion, 100);
      assert.equal(body.roadmap.nextMilestone, null);
      data.CareerRoadmap = saved;
    });

    await t.test("database failures return a sanitised 500", async () => {
      const response = await get(broken);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: "Could not load dashboard" });
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    process.chdir(originalDirectory);
  }
});
