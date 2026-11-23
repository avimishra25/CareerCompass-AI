const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { once } = require("node:events");
const express = require("express");

// Walks every route registered in server.js, so a new route is checked without editing this file.
const PUBLIC = new Set(["GET /"]);
// Routes that call the ML service without a per-user limiter. Keep this list short and justified.
const NO_USER_LIMIT = new Set([
  "POST /upload", // known gap (outside /api, so also outside the per-IP limiter); see CLAUDE.md
  "GET /api/ml/health", // health probe; no LLM or model work
]);

test("per-user collections are indexed by userId plus the field their lists sort on", () => {
  for (const [model, sortField] of [["JDMatch", "createdAt"], ["CareerRoadmap", "createdAt"],
    ["InterviewSession", "createdAt"], ["ResumeDraft", "updatedAt"]]) {
    const indexes = require(`./models/${model}`).schema.indexes().map(([fields]) => JSON.stringify(fields));
    assert.ok(indexes.includes(JSON.stringify({ userId: 1, [sortField]: -1 })), `${model}: ${indexes}`);
  }
});

test("every route requires a JWT, and ML-calling routes are rate limited per user", async (t) => {
  const env = { JWT_SECRET: "test-only-secret", INTERNAL_API_KEY: "test-only-key" };
  const authModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "middleware/auth.js"), "utf8"), {
    module: authModule, process: { env },
    require: (name) => name === "../models/User" ? { findById: () => ({ select: async () => null }) } : require(name),
  });
  let app, upstreamCalls = 0;
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
    axios: { post: async () => { upstreamCalls++; return { data: {} }; }, get: async () => { upstreamCalls++; return { data: {} }; } },
  };
  const originalDirectory = process.cwd();
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "careercompass-routes-")));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "server.js"), "utf8"), {
    require: (name) => mocks[name] || require(name), process: { env },
    console: { log() {}, error() {} }, Buffer,
  });
  const routes = app.router.stack.filter((layer) => layer.route).flatMap((layer) =>
    Object.keys(layer.route.methods).map((method) => ({
      key: `${method.toUpperCase()} ${layer.route.path}`, method: method.toUpperCase(), path: layer.route.path,
      handlers: layer.route.stack.map((item) => item.handle),
    })));
  const server = express.application.listen.call(app, 0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await t.test("route table includes the new modules", () => {
      const keys = routes.map((route) => route.key);
      for (const key of ["POST /api/roadmap", "POST /api/resume-builder/enhance", "POST /api/interview/start",
        "POST /api/interview/:id/answer", "GET /api/interview/history", "GET /api/interview/:id"]) {
        assert.ok(keys.includes(key), key);
      }
      assert.ok(routes.length >= 25);
    });

    await t.test("protect is the first handler of every non-public route", () => {
      for (const route of routes.filter((item) => !PUBLIC.has(item.key))) {
        assert.equal(route.handlers[0], authModule.exports, `${route.key} must start with protect`);
      }
    });

    await t.test("routes that call the ML service have a per-user limiter after protect", () => {
      const limited = [];
      for (const route of routes) {
        const callsMl = route.handlers.some((handle) => /axios\.(post|get)/.test(handle.toString()));
        if (!callsMl || NO_USER_LIMIT.has(route.key)) continue;
        // express-rate-limit middleware exposes resetKey().
        assert.equal(typeof route.handlers[1]?.resetKey, "function", `${route.key} needs a per-user rate limit`);
        limited.push(route.key);
      }
      // Guards against the detection silently matching nothing.
      assert.deepEqual([...limited].sort(), ["POST /api/agent/chat", "POST /api/interview/:id/answer", "POST /api/interview/start",
        "POST /api/jd-match", "POST /api/resume-builder/enhance", "POST /api/resume-builder/score", "POST /api/roadmap"]);
    });

    await t.test("no token or a bad token returns JSON 401 without reaching Flask", async () => {
      for (const route of routes.filter((item) => !PUBLIC.has(item.key))) {
        const url = origin + route.path.replace(/:\w+/g, "0".repeat(24));
        for (const headers of [{}, { Authorization: "Bearer not-a-jwt" }]) {
          const response = await fetch(url, { method: route.method, headers });
          assert.equal(response.status, 401, `${route.key} ${JSON.stringify(headers)}`);
          assert.match(response.headers.get("content-type"), /application\/json/);
          assert.doesNotMatch(await response.text(), /at .*\.js|stack|test-only/);
        }
      }
      assert.equal(upstreamCalls, 0);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    process.chdir(originalDirectory);
  }
});
