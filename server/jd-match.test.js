const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { once } = require("node:events");
const express = require("express");
const jwt = require("jsonwebtoken");

test("JDMatch schema validates bounded Unicode JD text and score; resume text is private by default", async () => {
  const JDMatch = require("./models/JDMatch");
  const Analysis = require("./models/Analysis");
  assert.equal(Analysis.schema.path("resumeText").options.select, false);
  const match = new JDMatch({
    userId: "a".repeat(24), analysisId: "b".repeat(24), jdText: "😀".repeat(8000),
    result: { overall_match: 75, verdict: "Strong" },
  });
  await match.validate();
  assert.ok(match.createdAt instanceof Date);
  match.jdText += "x";
  await assert.rejects(match.validate());
  match.jdText = "Python";
  match.result.overall_match = 101;
  await assert.rejects(match.validate());
});

test("JD matching HTTP boundaries", async (t) => {
  const owner = "a".repeat(24), other = "b".repeat(24), analysisId = "c".repeat(24), matchId = "d".repeat(24);
  const env = { JWT_SECRET: "test-only-secret", INTERNAL_API_KEY: "test-only-key" };
  const authModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "middleware/auth.js"), "utf8"), {
    module: authModule, process: { env },
    require: (name) => name === "../models/User" ? {
      findById: (id) => ({ select: async () => ({ _id: id, id }) }),
    } : require(name),
  });
  let app, lastCall, saved, historyFilter, deleteFilter;
  let legacy = false, unavailable = false, invalidResult = false, dbFailure = false;
  let calls = 0;
  const result = { overall_match: 90, matched_skills: ["python"], missing_skills: [], extra_skills: [], keyword_gaps: [], verdict: "Strong" };
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
      findOne: (filter) => ({ select: async (fields) => {
        assert.equal(fields, "+resumeText");
        return filter.user === owner && filter._id === analysisId
          ? { _id: analysisId, resumeText: legacy ? undefined : "Python Flask" } : null;
      } }),
    },
    "./models/JDMatch": {
      create: async (data) => {
        if (dbFailure) throw new Error("private DB details");
        saved = { ...data, _id: matchId, createdAt: "2026-10-05T00:00:00Z" };
        return saved;
      },
      find: (filter) => {
        historyFilter = filter;
        return { sort: () => ({ lean: async () => saved && saved.userId === filter.userId ? [saved] : [] }) };
      },
      findOneAndDelete: async (filter) => {
        deleteFilter = filter;
        if (saved?.userId !== filter.userId || saved?._id !== filter._id) return null;
        const deleted = saved;
        saved = null;
        return deleted;
      },
    },
    axios: { post: async (url, payload, options) => {
      calls++;
      lastCall = { url, payload, options };
      if (unavailable) throw new Error("private upstream details");
      return { data: invalidResult ? { ...result, overall_match: 101 } : result };
    } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "server.js"), "utf8"), {
    require: (name) => mocks[name] || require(name), process: { env },
    console: { log() {}, error() {} }, Buffer,
  });
  const server = express.application.listen.call(app, 0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/jd-match`;
  const request = (method, suffix = "", body, user = owner) => fetch(base + suffix, {
    method, headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${jwt.sign({ id: user }, env.JWT_SECRET)}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = { analysisId, jd_text: "Python Flask", jdTitle: "Backend" };
  try {
    await t.test("JWT required on every route", async () => {
      for (const [method, suffix] of [["POST", ""], ["GET", "/history"], ["DELETE", `/${matchId}`]]) {
        assert.equal((await request(method, suffix, method === "POST" ? payload : undefined, null)).status, 401);
      }
    });
    await t.test("reject invalid input and foreign analysis before calling Flask", async () => {
      for (const body of [{}, { ...payload, jd_text: " " }, { ...payload, analysisId: {} },
        { ...payload, jd_text: 42 }, { ...payload, jdTitle: "x".repeat(121) }, { ...payload, userId: other }]) {
        assert.equal((await request("POST", "", body)).status, 400);
      }
      assert.equal((await request("POST", "", { ...payload, jd_text: "x".repeat(8001) })).status, 413);
      assert.equal((await request("POST", "", payload, other)).status, 404);
      legacy = true;
      const response = await request("POST", "", payload);
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /Upload the resume again/);
      legacy = false;
      assert.equal(calls, 0);
    });
    await t.test("save only owner's match and send saved text/internal key", async () => {
      const response = await request("POST", "", payload);
      assert.equal(response.status, 201);
      assert.equal(saved.userId, owner);
      assert.equal(saved.analysisId, analysisId);
      assert.equal(saved.jdText, payload.jd_text);
      assert.equal(lastCall.payload.resume_text, "Python Flask");
      assert.equal(lastCall.options.headers["X-Internal-Key"], env.INTERNAL_API_KEY);
      assert.ok(lastCall.url.endsWith("/jd-match"));
      assert.equal((await (await request("GET", "/history")).json()).length, 1);
      assert.equal(historyFilter.userId, owner);
      assert.deepEqual(await (await request("GET", "/history", undefined, other)).json(), []);
      assert.equal((await request("DELETE", `/${matchId}`, undefined, other)).status, 404);
      assert.equal(deleteFilter.userId, other);
      assert.equal((await request("DELETE", "/bad-id")).status, 400);
      assert.equal((await request("DELETE", `/${matchId}`)).status, 200);
    });
    await t.test("service and database failures return clean JSON", async () => {
      unavailable = true;
      let response = await request("POST", "", payload);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: "JD matching unavailable" });
      unavailable = false;
      invalidResult = true;
      assert.equal((await request("POST", "", payload)).status, 503);
      invalidResult = false;
      dbFailure = true;
      response = await request("POST", "", payload);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: "Could not save JD match" });
      dbFailure = false;
    });
    await t.test("8000 Unicode characters accepted; per-user rate limit returns JSON", async () => {
      assert.equal((await request("POST", "", { ...payload, jd_text: "😀".repeat(8000) })).status, 201);
      let response;
      for (let i = 0; i < 21; i++) {
        response = await request("POST", "", payload, "rate-user");
        if (response.status === 429) break;
      }
      assert.equal(response.status, 429);
      assert.ok((await response.json()).error);
      assert.equal((await request("POST", "", payload, "another-rate-user")).status, 404);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
