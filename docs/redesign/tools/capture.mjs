// Screenshot every page of the built client with mocked API responses (no backend needed).
// Setup (outside the repo): npm install playwright-core@1.56.1, then copy these tools next to it.
// Usage: node capture.mjs <client/build dir> <output dir>   (CHROME_PATH overrides the browser)
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import * as fx from "./fixtures.mjs";

const [buildDir, outDir] = process.argv.slice(2);
const APP = "http://app.local";
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".svg": "image/svg+xml" };
fs.mkdirSync(outDir, { recursive: true });

function apiResponse(url, method) {
  const p = new URL(url).pathname;
  const routes = [
    ["GET", /^\/api\/auth\/me$/, { user: fx.user }],
    ["GET", /^\/api\/dashboard\/summary$/, fx.summary],
    ["GET", /^\/api\/history$/, fx.history],
    ["GET", /^\/api\/jd-match\/history$/, fx.jdMatches],
    ["GET", /^\/api\/roadmap(\/\w+)?$/, fx.roadmap],
    ["GET", /^\/api\/interview\/history$/, fx.interviewHistory],
    ["GET", /^\/api\/interview\/\w+$/, fx.session],
    ["GET", /^\/api\/resume-builder\/drafts$/, fx.draftList],
    ["GET", /^\/api\/resume-builder\/drafts\/\w+$/, fx.draft],
    ["POST", /^\/api\/resume-builder\/score$/, fx.score],
    ["POST", /^\/upload$/, fx.upload],
  ];
  const hit = routes.find(([m, re]) => m === method && re.test(p));
  return hit ? hit[2] : {};
}

async function setup(context) {
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("http://localhost:5000/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(apiResponse(url, route.request().method())) });
    }
    if (url.startsWith(APP)) {
      let file = path.join(buildDir, decodeURIComponent(new URL(url).pathname));
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(buildDir, "index.html");
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
    }
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.continue();
    return route.abort();
  });
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const sizes = [{ w: 1440, h: 900 }, { w: 390, h: 844 }];
const done = [];
for (const { w, h } of sizes) {
  const mobile = w < 1024;
  const shot = async (page, name) => {
    await page.waitForTimeout(1300); // entrance animations and charts
    const file = path.join(outDir, `${name}-${w}.jpg`);
    await page.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 85 });
    done.push(path.basename(file));
  };

  // Signed out: landing page.
  let context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await setup(context);
  let page = await context.newPage();
  await page.goto(`${APP}/`);
  await page.getByRole("button", { name: "Sign In with Google" }).first().waitFor();
  await shot(page, "01-landing");
  await context.close();

  // Signed in.
  context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await setup(context);
  await context.addInitScript(() => localStorage.setItem("token", "demo-token"));
  page = await context.newPage();
  const go = async (label) => {
    if (mobile) await page.getByRole("button", { name: "Open menu" }).click();
    const scope = page.getByTestId(mobile ? "mobile-nav" : "desktop-nav");
    await scope.getByRole("button", { name: label, exact: true }).click();
    await page.waitForTimeout(400);
  };
  await page.goto(`${APP}/`);
  await page.getByRole("region", { name: "Your stats" }).waitFor();
  await shot(page, "02-dashboard");

  await go("Analyze");
  await shot(page, "03-analyze-empty");
  await page.locator('input[type="file"]').setInputFiles({ name: "Riya_Sharma_Resume_v3.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 demo") });
  await page.getByRole("button", { name: /^Analyze Resume/ }).click();
  await page.getByRole("group", { name: "Next steps" }).waitFor();
  await shot(page, "04-analyze-results");
  await page.getByTitle("AI Career Coach").click();
  await shot(page, "05-career-coach");
  await page.getByTitle("AI Career Coach").click();

  await go("History");
  await shot(page, "06-history");
  const boxes = page.getByTitle("Select for comparison");
  await boxes.nth(0).click();
  await page.getByTitle("Select for comparison").nth(0).click();
  await page.getByRole("button", { name: /Compare Selected/ }).click();
  await shot(page, "07-compare");

  await go("JD Match");
  await page.getByRole("button", { name: /^Software Engineer Intern/ }).click();
  await page.getByRole("region", { name: "Match result" }).waitFor();
  await shot(page, "08-jd-match");

  await go("Roadmap");
  await page.getByRole("list", { name: "Roadmap milestones" }).waitFor();
  await shot(page, "09-roadmap");

  await go("Resume Builder");
  await page.getByRole("region", { name: "Resume preview" }).waitFor();
  await shot(page, "10-resume-builder");

  await go("Interview");
  await page.getByRole("article", { name: "Current question" }).waitFor();
  await shot(page, "11-interview-question");
  await page.getByRole("navigation", { name: "Session questions" }).getByRole("button").first().click();
  await page.getByRole("region", { name: "AI feedback" }).waitFor();
  await shot(page, "12-interview-feedback");

  await go("About");
  await shot(page, "13-about");

  if (mobile) await go("Profile");
  else { await page.getByRole("button", { name: "Profile" }).click(); await page.waitForTimeout(400); }
  await shot(page, "14-profile");

  if (mobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, `15-mobile-menu-${w}.jpg`), type: "jpeg", quality: 85 });
    done.push(`15-mobile-menu-${w}.jpg`);
  }
  await context.close();
}
await browser.close();
console.log(done.join("\n"));

