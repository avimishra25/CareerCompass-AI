const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { once } = require("node:events");
const express = require("express");
const jwt = require("jsonwebtoken");
const { parseDraft, groupSkills, extractSummary } = require("./lib/resumeBuilder");

const sections = {
  contact: { name: "Jane Doe", email: "jane@example.com", phone: "", links: ["github.com/jane"] },
  summary: "Student developer.",
  skills: [{ group: "Languages", items: ["python"] }],
  experience: [{ role: "Intern", org: "Acme", start: "May 2026", end: "Jul 2026", bullets: ["Built APIs"] }],
  projects: [{ name: "Portfolio", tech: ["html"], bullets: ["Built a site"] }],
  education: [{ degree: "B.Tech", institute: "Uni", start: "2023", end: "2027", score: "8.5" }],
  certifications: [], achievements: ["Hackathon finalist"],
};

test("draft validation helpers and schema limits", async () => {
  const parsed = parseDraft({ title: "  ", sections });
  assert.equal(parsed.title, "Untitled resume");
  assert.equal(parsed.template, "classic");
  assert.deepEqual(parsed.sections.certifications, []);
  for (const [body, status] of [[null, 400], [[], 400], [{ extra: 1 }, 400], [{ template: "fancy" }, 400],
    [{ atsScore: 101 }, 400], [{ sections: { contact: { name: 5 } } }, 400], [{ sections: { other: [] } }, 400],
    [{ sections: { summary: "x".repeat(1501) } }, 413], [{ sections: { achievements: Array(21).fill("x") } }, 413],
    [{ sections: { experience: [{ bullets: Array(9).fill("x") }] } }, 413], [{ title: "x".repeat(121) }, 413]]) {
    assert.throws(() => parseDraft(body), (error) => error.status === status, JSON.stringify(body)?.slice(0, 60));
  }
  assert.deepEqual(groupSkills(["react", "python", "docker", "unknown-skill", "node"]), [
    { group: "Languages", items: ["python"] }, { group: "Frontend", items: ["react"] },
    { group: "Backend", items: ["node"] }, { group: "Cloud & DevOps", items: ["docker"] },
    { group: "Other", items: ["unknown-skill"] },
  ]);
  assert.equal(extractSummary("Jane\nSummary\nFinal-year student\nbuilding web apps.\nSkills\nPython"), "Final-year student building web apps.");
  assert.equal(extractSummary("No heading here"), "");

  const ResumeDraft = require("./models/ResumeDraft");
  const draft = new ResumeDraft({ userId: "a".repeat(24), ...parseDraft({ sections }) });
  await draft.validate();
  draft.sections.summary = "😀".repeat(1501);
  await assert.rejects(draft.validate());
  draft.sections.summary = "";
  draft.sections.experience = Array(11).fill(sections.experience[0]);
  await assert.rejects(draft.validate());
});

test("Resume builder HTTP boundaries", async (t) => {
  const owner = "a".repeat(24), other = "b".repeat(24), draftId = "c".repeat(24), analysisId = "d".repeat(24);
  const env = { JWT_SECRET: "test-only-secret", INTERNAL_API_KEY: "test-only-key" };
  const authModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "middleware/auth.js"), "utf8"), {
    module: authModule, process: { env },
    require: (name) => name === "../models/User" ? {
      findById: (id) => ({ select: async () => ({ _id: id, id }) }),
    } : require(name),
  });
  let app, lastCall, drafts = [], flask = () => ({ data: { bullets: ["Built a site", "Added a form"] } });
  let filters = [];
  const own = (filter) => { filters.push(filter); return drafts.find((d) => d._id === filter._id && d.userId === filter.userId) || null; };
  const wrappedExpress = () => { app = express(); app.listen = () => {}; return app; };
  wrappedExpress.json = express.json;
  const mocks = {
    dotenv: { config() {} }, express: wrappedExpress, mongoose: { connect: async () => {} },
    "./config/passport": { initialize: () => (req, res, next) => next() },
    "./routes/auth": express.Router(), "./middleware/auth": authModule.exports,
    "./models/Analysis": {
      findOne: (filter) => ({ select: async () => filter.user === owner && filter._id === analysisId ? {
        _id: analysisId, resumeName: "resume.pdf", skills: ["react", "python"], targetRole: null,
        bestRole: { role: "fullstack developer" }, resumeText: "Jane\nProjects\nPortfolio",
      } : null }),
    },
    "./models/ResumeDraft": {
      countDocuments: async (filter) => drafts.filter((d) => d.userId === filter.userId).length,
      create: async (data) => { const saved = { ...data, _id: draftId }; drafts.push(saved); return saved; },
      find: (filter) => ({ select: () => ({ sort: () => ({ lean: async () => drafts.filter((d) => d.userId === filter.userId) }) }) }),
      findOne: (filter) => ({ lean: async () => own(filter) }),
      findOneAndUpdate: (filter, update) => ({ lean: async () => {
        const draft = own(filter);
        return draft ? Object.assign(draft, update.$set) : null;
      } }),
      findOneAndDelete: async (filter) => {
        const draft = own(filter);
        if (draft) drafts = drafts.filter((d) => d !== draft);
        return draft;
      },
    },
    axios: { post: async (url, payload, options) => { lastCall = { url, payload, options }; return flask(url); } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "server.js"), "utf8"), {
    require: (name) => mocks[name] || require(name), process: { env }, console: { log() {}, error() {} }, Buffer,
  });
  const server = express.application.listen.call(app, 0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/resume-builder`;
  const request = (method, suffix, body, user = owner) => fetch(base + suffix, {
    method, headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${jwt.sign({ id: user }, env.JWT_SECRET)}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const enhanceBody = { section: "project", title: "Portfolio", notes: "made a site", tone: "concise" };
  try {
    await t.test("JWT required on every route", async () => {
      for (const [method, suffix, body] of [["GET", "/drafts"], ["POST", "/drafts", {}], ["GET", `/drafts/${draftId}`],
        ["PUT", `/drafts/${draftId}`, {}], ["DELETE", `/drafts/${draftId}`], ["POST", "/enhance", enhanceBody],
        ["POST", "/score", { text: "x" }], ["POST", "/import", { analysisId }]]) {
        assert.equal((await request(method, suffix, body, null)).status, 401, `${method} ${suffix}`);
      }
    });
    await t.test("draft CRUD is owner scoped", async () => {
      let response = await request("POST", "/drafts", { title: "Main", sections });
      assert.equal(response.status, 201);
      assert.equal(drafts[0].userId, owner);
      assert.equal(drafts[0].sections.contact.name, "Jane Doe");
      assert.equal((await (await request("GET", "/drafts")).json()).length, 1);
      assert.equal((await (await request("GET", "/drafts", undefined, other)).json()).length, 0);
      assert.equal((await request("GET", `/drafts/${draftId}`)).status, 200);
      for (const [method, body] of [["GET"], ["PUT", { title: "Stolen" }], ["DELETE"]]) {
        assert.equal((await request(method, `/drafts/${draftId}`, body, other)).status, 404, `${method} by other user`);
      }
      assert.equal(drafts[0].title, "Main");
      assert.ok(filters.every((filter) => filter.userId));
      response = await request("PUT", `/drafts/${draftId}`, { title: "Renamed", sections: { ...sections, summary: "New" } });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).sections.summary, "New");
      for (const method of ["GET", "PUT", "DELETE"]) {
        assert.equal((await request(method, "/drafts/bad-id", method === "PUT" ? {} : undefined)).status, 400);
      }
      assert.equal((await request("DELETE", `/drafts/${draftId}`)).status, 200);
      assert.equal((await request("GET", `/drafts/${draftId}`)).status, 404);
    });
    await t.test("draft validation and per-user draft cap", async () => {
      for (const body of [[], { userId: other }, { template: "modern" }, { sections: { skills: "python" } }]) {
        assert.equal((await request("POST", "/drafts", body)).status, 400);
      }
      assert.equal((await request("POST", "/drafts", { sections: { summary: "x".repeat(1501) } })).status, 413);
      drafts = Array.from({ length: 20 }, (_, i) => ({ _id: String(i), userId: owner }));
      assert.equal((await request("POST", "/drafts", {})).status, 409);
      assert.equal((await request("POST", "/drafts", {}, other)).status, 201);
      drafts = [];
    });
    await t.test("import pre-fills grouped skills and a factual summary from the owner's analysis", async () => {
      assert.equal((await request("POST", "/import", { analysisId }, other)).status, 404);
      assert.equal((await request("POST", "/import", { analysisId: "bad" })).status, 400);
      const data = await (await request("POST", "/import", { analysisId })).json();
      assert.deepEqual(data.sections.skills, [{ group: "Languages", items: ["python"] }, { group: "Frontend", items: ["react"] }]);
      assert.equal(data.summarySource, "analysis");
      assert.match(data.sections.summary, /fullstack developer.*python, react/);
    });
    await t.test("enhance validates, forwards only known fields, and sanitises failures", async () => {
      for (const body of [{}, { ...enhanceBody, section: "skills" }, { ...enhanceBody, tone: "loud" },
        { ...enhanceBody, notes: " " }, { ...enhanceBody, extra: 1 }]) {
        assert.equal((await request("POST", "/enhance", body)).status, 400);
      }
      assert.equal((await request("POST", "/enhance", { ...enhanceBody, notes: "x".repeat(1501) })).status, 413);
      assert.deepEqual(await (await request("POST", "/enhance", enhanceBody)).json(), { bullets: ["Built a site", "Added a form"] });
      assert.ok(lastCall.url.endsWith("/resume/enhance"));
      assert.equal(lastCall.options.headers["X-Internal-Key"], env.INTERNAL_API_KEY);
      flask = () => ({ data: { bullets: ["only one"] } });
      assert.equal((await request("POST", "/enhance", enhanceBody)).status, 503);
      flask = () => { throw { response: { status: 502, data: { error: "AI returned an invalid suggestion. Try again." } } }; };
      let response = await request("POST", "/enhance", enhanceBody);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { error: "AI returned an invalid suggestion. Try again." });
      flask = () => { throw new Error("private upstream detail"); };
      response = await request("POST", "/enhance", enhanceBody);
      assert.equal(response.status, 503);
      assert.doesNotMatch(await response.text(), /private/);
    });
    await t.test("score validates input and Flask output", async () => {
      const breakdown = { skills: { score: 6, max: 30, label: "Skill coverage" } };
      flask = () => ({ data: { ats_score: 64, ats_breakdown: breakdown, ml_insights: { model: "GBR" } } });
      const response = await request("POST", "/score", { text: "Python developer" });
      assert.equal(JSON.stringify(await response.json()), JSON.stringify({ atsScore: 64, atsBreakdown: breakdown, mlInsights: { model: "GBR" } }));
      assert.ok(lastCall.url.endsWith("/resume/score"));
      for (const body of [{}, { text: " " }, { text: 5 }, { text: "x", extra: 1 }]) {
        assert.equal((await request("POST", "/score", body)).status, 400);
      }
      assert.equal((await request("POST", "/score", { text: "x".repeat(50001) })).status, 413);
      flask = () => ({ data: { ats_score: 101, ats_breakdown: breakdown } });
      assert.equal((await request("POST", "/score", { text: "x" })).status, 503);
    });
    await t.test("enhance is limited to 30 per user per 15 minutes", async () => {
      flask = () => ({ data: { bullets: ["Built a site", "Added a form"] } });
      let response;
      for (let i = 0; i < 31; i++) {
        response = await request("POST", "/enhance", enhanceBody, "1".repeat(24));
        if (response.status === 429) break;
      }
      assert.equal(response.status, 429);
      assert.ok((await response.json()).error);
      assert.equal((await request("POST", "/enhance", enhanceBody, "2".repeat(24))).status, 200);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
