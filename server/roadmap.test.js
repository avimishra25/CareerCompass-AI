const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { once } = require("node:events");
const express = require("express");
const jwt = require("jsonwebtoken");

test("CareerRoadmap schema bounds milestones and statuses", async () => {
  const CareerRoadmap = require("./models/CareerRoadmap");
  const milestone = { week: 1, skill: "docker", objective: "Learn images", resources: ["Docs", "Tutorial"], miniProject: "Dockerise app" };
  const roadmap = new CareerRoadmap({
    userId: "a".repeat(24), analysisId: "b".repeat(24), targetRole: "devops engineer", hoursPerWeek: 8, milestones: [milestone],
  });
  await roadmap.validate();
  assert.equal(roadmap.milestones[0].status, "todo");
  assert.equal(roadmap.jdMatchId, null);
  roadmap.milestones[0].status = "finished";
  await assert.rejects(roadmap.validate());
  roadmap.milestones[0].status = "done";
  roadmap.milestones[0].resources = ["Only one"];
  await assert.rejects(roadmap.validate());
  roadmap.milestones[0].resources = ["Docs", "Tutorial"];
  roadmap.hoursPerWeek = 41;
  await assert.rejects(roadmap.validate());
});

test("Roadmap HTTP boundaries", async (t) => {
  const owner = "a".repeat(24), other = "b".repeat(24), analysisId = "c".repeat(24);
  const jdMatchId = "d".repeat(24), roadmapId = "e".repeat(24), milestoneId = "f".repeat(24);
  const env = { JWT_SECRET: "test-only-secret", INTERNAL_API_KEY: "test-only-key" };
  const authModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "middleware/auth.js"), "utf8"), {
    module: authModule, process: { env },
    require: (name) => name === "../models/User" ? {
      findById: (id) => ({ select: async () => ({ _id: id, id }) }),
    } : require(name),
  });
  const flaskResult = {
    covered: false, message: "", skill_gaps: ["docker", "kubernetes"],
    milestones: [1, 2, 3, 4].map((week) => ({
      week, skill: week < 3 ? "docker" : "kubernetes", title: `Subtopic ${week}`, objective: `Objective ${week}`,
      resources: ["Docs", "Free course"], mini_project: "Extend Expense Tracker",
    })),
  };
  let app, lastCall, saved, roadmapUpdate, calls = 0;
  let flaskResponse = () => ({ data: flaskResult });
  const stored = () => ({
    _id: roadmapId, userId: owner, targetRole: "devops engineer", skillGaps: ["docker"],
    milestones: [{ _id: milestoneId, week: 1, skill: "docker", status: "todo" }],
  });
  let roadmapDoc = stored();
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
      findOne: (filter) => ({ select: async () => filter.user === owner && filter._id === analysisId ? {
        _id: analysisId, skills: ["linux", "git"], targetRole: null, bestRole: { role: "devops engineer" },
        resumeText: "Projects\nExpense Tracker",
        match: new Map([["devops engineer", { missing: ["docker", "kubernetes"] }], ["frontend developer", { missing: [] }]]),
      } : null }),
      create: async (data) => ({ ...data, _id: analysisId }),
    },
    "./models/JDMatch": {
      findOne: async (filter) => filter.userId === owner && filter._id === jdMatchId
        ? { _id: jdMatchId, result: { missing_skills: ["terraform", "docker"] } } : null,
    },
    "./models/CareerRoadmap": {
      create: async (data) => { saved = { ...data, _id: roadmapId }; return saved; },
      findOne: (filter) => {
        const match = filter.userId === owner && (!filter._id || filter._id === roadmapId) ? roadmapDoc : null;
        const lean = async () => match;
        return { lean, sort: () => ({ lean }) };
      },
      findOneAndUpdate: (filter, update) => ({ lean: async () => {
        if (filter.userId !== owner || filter._id !== roadmapId || filter["milestones._id"] !== milestoneId) return null;
        roadmapDoc.milestones[0].status = update.$set["milestones.$.status"];
        return roadmapDoc;
      } }),
      updateMany: async (...args) => { roadmapUpdate = args; },
    },
    axios: { post: async (url, payload, options) => {
      if (url.endsWith("/analyze")) {
        if (typeof payload.resume === "function") { const ended = once(payload, "end"); payload.resume(); await ended; }
        return { data: { skills: ["docker", "python"], raw_text: "Docker Python" } };
      }
      calls++;
      lastCall = { url, payload, options };
      return flaskResponse();
    } },
  };
  const originalDirectory = process.cwd();
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "careercompass-roadmap-")));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "server.js"), "utf8"), {
    require: (name) => mocks[name] || require(name), process: { env },
    console: { log() {}, error() {} }, Buffer,
  });
  const server = express.application.listen.call(app, 0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const token = (user) => `Bearer ${jwt.sign({ id: user }, env.JWT_SECRET)}`;
  const request = (method, suffix = "", body, user = owner) => fetch(`${origin}/api/roadmap${suffix}`, {
    method, headers: { "Content-Type": "application/json", ...(user ? { Authorization: token(user) } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = { analysisId, hoursPerWeek: 8 };
  const patchPath = `/${roadmapId}/milestone/${milestoneId}`;
  try {
    await t.test("JWT required on every route", async () => {
      for (const [method, suffix, body] of [["POST", "", payload], ["GET", ""], ["GET", `/${roadmapId}`],
        ["PATCH", patchPath, { status: "done" }]]) {
        assert.equal((await request(method, suffix, body, null)).status, 401);
      }
    });
    await t.test("reject invalid input and foreign records before calling Flask", async () => {
      for (const body of [{}, [], { ...payload, analysisId: "bad" }, { ...payload, hoursPerWeek: 1 },
        { ...payload, hoursPerWeek: 41 }, { ...payload, hoursPerWeek: 8.5 }, { ...payload, hoursPerWeek: "8" },
        { ...payload, targetRole: "astronaut" }, { ...payload, jdMatchId: "bad" }, { ...payload, userId: other }]) {
        // A separate user keeps these requests out of the owner's 10-request generation limit.
        assert.equal((await request("POST", "", body, "9".repeat(24))).status, 400, JSON.stringify(body));
      }
      assert.equal((await request("POST", "", payload, other)).status, 404);
      assert.equal((await request("POST", "", { ...payload, jdMatchId: "0".repeat(24) })).status, 404);
      assert.equal(calls, 0);
    });
    await t.test("builds payload from owned analysis and JD match, saves 201", async () => {
      const response = await request("POST", "", { ...payload, jdMatchId });
      assert.equal(response.status, 201);
      assert.ok(lastCall.url.endsWith("/roadmap"));
      assert.equal(lastCall.options.headers["X-Internal-Key"], env.INTERNAL_API_KEY);
      assert.equal(JSON.stringify(lastCall.payload), JSON.stringify({
        target_role: "devops engineer", missing_skills: ["docker", "kubernetes"], jd_gaps: ["terraform", "docker"],
        known_skills: ["linux", "git"], hours_per_week: 8, resume_text: "Projects\nExpense Tracker",
      }));
      assert.equal(saved.userId, owner);
      assert.equal(saved.jdMatchId, jdMatchId);
      assert.equal(saved.milestones.length, 4);
      assert.equal(saved.milestones[2].title, "Subtopic 3");
      assert.equal(saved.milestones[0].miniProject, "Extend Expense Tracker");
      assert.equal((await response.json()).targetRole, "devops engineer");
    });
    await t.test("invalid or failing Flask responses return safe JSON", async () => {
      flaskResponse = () => ({ data: { ...flaskResult, milestones: [{ ...flaskResult.milestones[0], skill: "rust" }] } });
      let response = await request("POST", "", payload);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: "Roadmap generation unavailable" });
      flaskResponse = () => { throw { response: { status: 502, data: { error: "AI returned an invalid roadmap. Try again." } } }; };
      response = await request("POST", "", payload);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { error: "AI returned an invalid roadmap. Try again." });
      flaskResponse = () => { throw { response: { status: 500, data: { error: "private traceback" } } }; };
      response = await request("POST", "", payload);
      assert.equal(response.status, 503);
      assert.doesNotMatch(await response.text(), /private/);
      // At most 2 weeks per gap, and no title used more than twice.
      for (const milestones of [
        [1, 2, 3].map((week) => ({ ...flaskResult.milestones[0], week })),
        flaskResult.milestones.map((item) => ({ ...item, title: "Same title" })),
        flaskResult.milestones.map(({ title, ...item }) => item),
      ]) {
        flaskResponse = () => ({ data: { ...flaskResult, milestones } });
        assert.equal((await request("POST", "", payload)).status, 503, JSON.stringify(milestones[0]));
      }
      flaskResponse = () => ({ data: { covered: true, message: "covered", skill_gaps: [], milestones: [] } });
      assert.equal((await request("POST", "", payload)).status, 201);
      assert.equal(saved.covered, true);
      flaskResponse = () => ({ data: flaskResult });
    });
    await t.test("GET latest and by id are owner scoped", async () => {
      assert.equal((await (await request("GET")).json())._id, roadmapId);
      assert.equal(await (await request("GET", "", undefined, other)).json(), null);
      assert.equal((await request("GET", `/${roadmapId}`)).status, 200);
      assert.equal((await request("GET", `/${roadmapId}`, undefined, other)).status, 404);
      assert.equal((await request("GET", "/bad-id")).status, 400);
    });
    await t.test("PATCH validates status and ownership", async () => {
      for (const body of [{}, { status: "finished" }, { status: "done", extra: 1 }, []]) {
        assert.equal((await request("PATCH", patchPath, body)).status, 400);
      }
      assert.equal((await request("PATCH", `/bad/milestone/${milestoneId}`, { status: "done" })).status, 400);
      assert.equal((await request("PATCH", patchPath, { status: "done" }, other)).status, 404);
      assert.equal(roadmapDoc.milestones[0].status, "todo");
      assert.equal((await request("PATCH", `/${roadmapId}/milestone/${"0".repeat(24)}`, { status: "done" })).status, 404);
      const response = await request("PATCH", patchPath, { status: "progress" });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).milestones[0].status, "progress");
    });
    await t.test("new analysis marks matching milestones done", async () => {
      const body = new FormData();
      body.append("resume", new Blob(["%PDF-test"], { type: "application/pdf" }), "resume.pdf");
      const response = await fetch(`${origin}/upload`, { method: "POST", body, headers: { Authorization: token(owner) } });
      assert.equal(response.status, 200);
      const [filter, update, options] = roadmapUpdate;
      assert.equal(filter.userId, owner);
      // Objects built inside the vm context have other-realm prototypes; compare as JSON.
      assert.equal(JSON.stringify(update), JSON.stringify({ $set: { "milestones.$[m].status": "done" } }));
      assert.equal(JSON.stringify(options.arrayFilters[0]["m.skill"].$in), JSON.stringify(["docker", "python"]));
    });
    await t.test("generation is limited per user", async () => {
      let response;
      for (let i = 0; i < 11; i++) {
        response = await request("POST", "", payload, "1".repeat(24));
        if (response.status === 429) break;
      }
      assert.equal(response.status, 429);
      assert.ok((await response.json()).error);
      assert.equal((await request("POST", "", payload, "2".repeat(24))).status, 404);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    process.chdir(originalDirectory);
  }
});
