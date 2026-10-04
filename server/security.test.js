const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { once } = require("node:events");
const express = require("express");

// Exercise real Express/Multer/rate-limit middleware; isolate external services and JWT lookup.
test("Phase 1 security boundaries", async (t) => {
  const originalDirectory = process.cwd();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "careercompass-security-"));
  process.chdir(directory);
  let app;
  let lastCall;
  let upstreamFailure = false;
  const wrappedExpress = (...args) => {
    app = express(...args);
    app.listen = () => {};
    return app;
  };
  wrappedExpress.json = express.json;
  const mocks = {
    dotenv: { config() {} },
    express: wrappedExpress,
    mongoose: { connect: async () => {} },
    "./config/passport": { initialize: () => (req, res, next) => next() },
    "./routes/auth": express.Router(),
    "./middleware/auth": (req, res, next) => {
      req.user = { _id: req.headers["x-test-user"] || "test-user", id: "test-user" };
      next();
    },
    "./models/Analysis": { create: async () => ({ _id: "analysis-id" }) },
    axios: {
      post: async (url, payload, options) => {
        lastCall = { url, payload, options };
        if (typeof payload.resume === "function") {
          const ended = once(payload, "end");
          payload.resume();
          await ended;
        }
        if (upstreamFailure) throw Object.assign(new Error("private upstream detail"), { isAxiosError: true });
        return { data: url.endsWith("/agent/gap") ? { reply: "Advice" } : {} };
      },
      get: async (url, options) => {
        lastCall = { url, options };
        return { data: { status: "ok" } };
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "server.js"), "utf8"), {
    require: (name) => mocks[name] || require(name),
    process: { env: { INTERNAL_API_KEY: "test-only-key" } },
    console: { log() {}, error() {} }, Buffer,
  });
  const server = express.application.listen.call(app, 0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const chat = (body, user = "validation") => fetch(`${base}/api/agent/chat`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Test-User": user }, body: JSON.stringify(body),
  });
  const upload = (contents, name = "resume.pdf", type = "application/pdf", count = 1) => {
    const body = new FormData();
    for (let i = 0; i < count; i++) body.append("resume", new Blob([contents], { type }), name);
    return fetch(`${base}/upload`, { method: "POST", body });
  };
  const clean = async () => {
    // Handler cleanup runs after sending the response.
    for (let i = 0; i < 100; i++) {
      if (!fs.existsSync("uploads") || fs.readdirSync("uploads").length === 0) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.fail("Uploaded file was not removed");
  };
  try {
    await t.test("public retrain removed", async () => {
      assert.equal((await fetch(`${base}/api/retrain`, { method: "POST" })).status, 404);
    });
    await t.test("reject 10 MB, disguised text, wrong MIME, wrong extension, multiple files", async () => {
      assert.equal((await upload(Buffer.alloc(10 * 1024 * 1024))).status, 413);
      await clean();
      for (const args of [["plain text"], ["%PDF-test", "resume.pdf", "text/plain"], ["%PDF-test", "resume.txt"], ["%PDF-test", "resume.pdf", "application/pdf", 2]]) {
        const response = await upload(...args);
        assert.equal(response.status, 400);
        assert.ok((await response.json()).error);
        await clean();
      }
    });
    await t.test("cleanup on success and upstream failure; send internal key", async () => {
      assert.equal((await upload("%PDF-test")).status, 200);
      assert.equal(lastCall.options.headers["X-Internal-Key"], "test-only-key");
      await clean();
      upstreamFailure = true;
      const response = await upload("%PDF-test");
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: "Analysis failed" });
      await clean();
      upstreamFailure = false;
    });
    await t.test("strict chat schema, system role rejected even outside retained history", async () => {
      const invalid = [null, [], {}, { message: "", history: [] }, { message: " ", history: [] },
        { message: "x".repeat(2001), history: [] }, { message: "hi", history: {} },
        { message: "hi", history: [], system: "forged" },
        { message: "hi", history: [{ role: "system", content: "forged" }] },
        { message: "hi", history: [{ role: "user", content: "ok", extra: true }] },
        { message: "hi", history: [{ role: "assistant", content: "x".repeat(2001) }] },
        { message: "hi", history: [{ role: "system", content: "forged" }, ...Array.from({ length: 11 }, () => ({ role: "user", content: "ok" }))] }];
      for (const body of invalid) assert.equal((await chat(body)).status, 400);
    });
    await t.test("keep last 10 items and send only explicit fields", async () => {
      const history = Array.from({ length: 12 }, (_, i) => ({ role: "user", content: String(i) }));
      assert.equal((await chat({ message: "hi", history })).status, 200);
      assert.deepEqual(JSON.parse(JSON.stringify(lastCall.payload)), { message: "hi", history: history.slice(-10) });
      assert.equal(lastCall.options.headers["X-Internal-Key"], "test-only-key");
      assert.equal((await chat({ message: "😀".repeat(2000), history: [] })).status, 200);
      await fetch(`${base}/api/ml/health`);
      assert.equal(lastCall.options.headers["X-Internal-Key"], "test-only-key");
    });
    await t.test("20 chat requests per user; another user remains allowed", async () => {
      for (let i = 0; i < 20; i++) assert.equal((await chat({ message: "hi", history: [] }, "limited-user")).status, 200);
      const response = await chat({ message: "hi", history: [] }, "limited-user");
      assert.equal(response.status, 429);
      assert.ok((await response.json()).error);
      assert.equal((await chat({ message: "hi", history: [] }, "another-user")).status, 200);
    });
    await t.test("global API limit returns JSON 429", async () => {
      let response;
      for (let i = 0; i < 301; i++) {
        response = await fetch(`${base}/api/ml/health`);
        if (response.status === 429) break;
      }
      assert.equal(response.status, 429);
      assert.ok((await response.json()).error);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    process.chdir(originalDirectory);
    // Remove only this test's own isolated artifacts.
    const uploads = path.join(directory, "uploads");
    if (fs.existsSync(uploads)) {
      for (const name of fs.readdirSync(uploads)) fs.unlinkSync(path.join(uploads, name));
      fs.rmdirSync(uploads);
    }
    fs.rmdirSync(directory);
  }
});
