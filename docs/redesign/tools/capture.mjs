// Screenshot every page of the built client with mocked API responses (no backend needed),
// and report layout problems (horizontal scroll, text overflowing its box) per page and width.
// Setup (outside the repo): npm install playwright-core@1.56.1, then copy these tools next to it.
// Usage: node capture.mjs <client/build> <out dir> [--widths=1440,390] [--only=dashboard,analyze-results] [--png] [--viewport]
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import * as fx from "./fixtures.mjs";

const args = process.argv.slice(2);
const [buildDir, outDir] = args.filter((arg) => !arg.startsWith("--"));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
const widths = (option("widths") || "1440,390").split(",").map(Number);
const only = option("only")?.split(",");
const png = args.includes("--png");
const viewportOnly = args.includes("--viewport");
const APP = "http://app.local";
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".json": "application/json", ".svg": "image/svg+xml" };
fs.mkdirSync(outDir, { recursive: true });

const ROUTES = [
  ["GET", /^\/api\/auth\/me$/, () => ({ user: fx.user })],
  ["GET", /^\/api\/dashboard\/summary$/, () => fx.summary],
  ["GET", /^\/api\/history$/, () => fx.history],
  ["GET", /^\/api\/jd-match\/history$/, () => fx.jdMatches],
  ["GET", /^\/api\/roadmap(\/\w+)?$/, () => fx.roadmap],
  ["GET", /^\/api\/interview\/history$/, () => fx.interviewHistory],
  ["GET", /^\/api\/interview\/\w+$/, () => fx.session],
  ["GET", /^\/api\/resume-builder\/drafts$/, () => fx.draftList],
  ["GET", /^\/api\/resume-builder\/drafts\/\w+$/, () => fx.draft],
  ["POST", /^\/api\/resume-builder\/score$/, () => fx.score],
  ["POST", /^\/upload$/, () => fx.upload],
];

async function newContext(browser, width, signedIn) {
  const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, deviceScaleFactor: 1 });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("http://localhost:5000/")) {
      const hit = ROUTES.find(([method, re]) => method === route.request().method() && re.test(new URL(url).pathname));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(hit ? hit[2]() : {}) });
    }
    if (url.startsWith(APP)) {
      let file = path.join(buildDir, decodeURIComponent(new URL(url).pathname));
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(buildDir, "index.html");
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
    }
    return route.abort();
  });
  if (signedIn) await context.addInitScript(() => localStorage.setItem("token", "demo-token"));
  return context;
}

// Navigate through the real sidebar (the drawer below 1024px).
async function go(page, width, label) {
  if (width < 1024) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog", { name: "Navigation" }).getByRole("button", { name: label, exact: true }).click();
  } else {
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: label, exact: true }).click();
  }
  await page.waitForTimeout(300);
}

// Each step: [name, async (page, width) => {...}] run in order in one signed-in session.
const STEPS = [
  ["dashboard", async (page) => { await page.getByRole("region", { name: "Key metrics" }).waitFor(); await page.getByText("Week 3 · SQL").waitFor(); }],
  ["analyze-empty", async (page, width) => { await go(page, width, "Resume analysis"); await page.getByRole("button", { name: "Analyze resume" }).waitFor(); }],
  ["analyze-results", async (page) => {
    await page.getByLabel("Resume PDF").setInputFiles({ name: "Rahul_Verma_Resume_v3.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 demo") });
    await page.getByRole("button", { name: "Analyze resume" }).click();
    await page.getByRole("region", { name: "Analysis summary" }).waitFor();
  }],
  ["analyze-match", async (page) => { await page.getByRole("tab", { name: "Career match" }).click(); }],
  ["career-coach", async (page) => { await page.getByRole("button", { name: "Career coach", exact: true }).click(); await page.getByRole("complementary", { name: "Career coach" }).waitFor(); }],
  ["history", async (page, width) => {
    if (await page.getByRole("complementary", { name: "Career coach" }).isVisible()) await page.getByRole("button", { name: "Close career coach" }).click();
    await go(page, width, "History");
    await page.getByRole("checkbox").first().waitFor();
  }],
  ["compare", async (page) => {
    await page.getByRole("checkbox").nth(0).check();
    await page.getByRole("checkbox").nth(1).check();
    await page.getByRole("button", { name: "Compare selected" }).click();
    await page.getByRole("table", { name: "Comparison" }).waitFor();
  }],
  ["jd-match", async (page, width) => {
    await go(page, width, "JD match");
    await page.getByRole("button", { name: /^Open Software Engineer Intern/ }).click();
    await page.getByRole("region", { name: "Match result" }).waitFor();
  }],
  ["roadmap", async (page, width) => { await go(page, width, "Roadmap"); await page.getByRole("list", { name: "Roadmap milestones" }).waitFor(); }],
  ["resume-builder", async (page, width) => {
    await go(page, width, "Resume builder");
    await page.getByRole("region", { name: "Resume preview" }).waitFor();
    await page.getByRole("img", { name: /^ATS score \d+ out of 100$/ }).waitFor(); // debounced live score
  }],
  ["interview-question", async (page, width) => { await go(page, width, "Interview prep"); await page.getByRole("article", { name: "Current question" }).waitFor(); }],
  ["interview-feedback", async (page) => {
    await page.getByRole("navigation", { name: "Session questions" }).getByRole("button").first().click();
    await page.getByRole("region", { name: "AI feedback" }).waitFor();
  }],
  ["about", async (page, width) => { await go(page, width, "About"); await page.getByRole("heading", { level: 1 }).waitFor(); }],
  ["profile", async (page, width) => {
    if (width < 1024) await page.getByRole("button", { name: "Open navigation" }).click();
    const scope = width < 1024 ? page.getByRole("dialog", { name: "Navigation" }) : page.getByRole("navigation", { name: "Main" }).locator("xpath=..");
    await scope.getByRole("button", { name: /^Account:/ }).click();
    await page.getByRole("menuitem", { name: "Profile" }).click();
    await page.getByRole("heading", { level: 1, name: "Profile" }).waitFor();
  }],
];

async function audit(page) {
  return page.evaluate(() => {
    const overflowing = [...document.querySelectorAll("body *")].filter((node) => {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || !node.textContent.trim() || node.children.length) return false;
      // Visually hidden helpers (sr-only, 1px wide and clipped) are not layout bugs.
      if (node.getBoundingClientRect().width <= 1 || style.clip.startsWith("rect(0")) return false;
      // Deliberate truncation (ellipsis or line clamp) is fine; clipped text without it is not.
      if (style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none") return false;
      return node.scrollWidth > node.clientWidth + 1 && style.overflowX !== "auto" && style.overflowX !== "scroll";
    }).slice(0, 5).map((node) => `${node.tagName.toLowerCase()}: ${node.textContent.trim().slice(0, 40)}`);
    return { horizontalScroll: document.documentElement.scrollWidth > innerWidth, overflowing };
  });
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const report = {};
for (const width of widths) {
  const shoot = async (page, name) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const file = path.join(outDir, `${name}-${width}.${png ? "png" : "jpg"}`);
    await page.screenshot({ path: file, fullPage: !viewportOnly, ...(png ? {} : { type: "jpeg", quality: 85 }) });
    report[`${name}-${width}`] = await audit(page);
  };
  if (!only || only.includes("landing")) {
    const context = await newContext(browser, width, false);
    const page = await context.newPage();
    await page.goto(`${APP}/`);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await shoot(page, "landing");
    await context.close();
  }
  const context = await newContext(browser, width, true);
  const page = await context.newPage();
  await page.goto(`${APP}/`);
  for (const [name, run] of STEPS) {
    await run(page, width);
    if (!only || only.includes(name)) await shoot(page, name);
    // Stop after the last requested step; later steps may depend on pages not yet redesigned.
    if (only && STEPS.findIndex(([step]) => step === name) >= Math.max(...only.map((item) => STEPS.findIndex(([step]) => step === item)))) break;
  }
  await context.close();
}
await browser.close();
for (const [name, { horizontalScroll, overflowing }] of Object.entries(report)) {
  console.log(`${horizontalScroll || overflowing.length ? "ISSUE" : "ok   "} ${name}${horizontalScroll ? " horizontal-scroll" : ""}${overflowing.length ? ` overflow: ${overflowing.join(" | ")}` : ""}`);
}
