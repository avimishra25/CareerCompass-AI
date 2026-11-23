# CLAUDE.md

Guidance for Claude Code sessions working in this repository. Read this first, then read the code you are about to change and match it. `README.md` is the user-facing doc and has the deployment details; `AGENTS.MD` (repo root) holds the per-phase working rules.

## Working rules (from AGENTS.MD)

- Do only the phase you are given. When finished, list the changed files, give test steps, and stop. Do not start the next phase.
- Read existing code first and match its style. No unrelated refactors.
- Google OAuth is out of scope: do not touch `server/config/passport.js` or the `googleId` field.
- No hardcoded secrets. Use env vars, and update the README environment sections and the `.env.example` files whenever you add one.
- Validate all input server-side and return clean JSON errors with the correct status (400/401/413/429/500/503). Never leak stack traces.

## Architecture

Three services. The browser only ever talks to Node; Flask is never exposed to it.

```
React 19 + Tailwind (client/, Vercel)
        │  HTTPS, Authorization: Bearer <JWT>
        ▼
Node 20.19+ / Express 5 gateway (server/, Render) ── Mongoose ──► MongoDB Atlas
        │  HTTPS, X-Internal-Key: <INTERNAL_API_KEY>
        ▼
Flask ML service (ml-service/, Hugging Face Space) ── google-genai ──► Gemini
   spaCy · TF-IDF · scikit-learn GradientBoostingRegressor
```

- **client/**: Create React App (`react-scripts` 5), React 19, Tailwind 3, axios, jsPDF/html2canvas (PDF export), recharts (ProgressTracker). `react-router-dom` is installed but unused, because navigation is state-based (see UI conventions).
- **server/**: CommonJS. `server.js` holds nearly all routes. `routes/auth.js` has Google OAuth (Passport) and `/api/auth/me`. JWTs last 7 days and are handed to the client via redirect to `CLIENT_URL?token=...`. Models are in `models/` (`User`, `Analysis`, `JDMatch`). `middleware/auth.js` exports `protect`. `nodemailer`, `resend` and `bcrypt*` are in `package.json` but not referenced by any code.
- **ml-service/**: `app.py` (Flask, spaCy skill extraction, TF-IDF ranking, ATS regressor, JD matching) and `llm.py` (the only Gemini boundary). It listens on port 8000. `ats_model.pkl` is git-ignored and trained on first start. The ATS score is a heuristic trained on synthetic data, so don't present it as a validated prediction.
- **Internal auth**: a Flask `before_request` hook requires `X-Internal-Key` on every route except `/health`. A missing or wrong key returns 401. If `INTERNAL_API_KEY` is unset, Flask returns 403 for everything protected. Node adds the header via `internalHeaders()`. The same secret must be set in both services, and it must never reach the client or be committed.
- **Deploy**: pushing `main` triggers `.github/workflows/sync_to_hf.yml`, which force-pushes `ml-service/` to the Hugging Face Space (Dockerfile, Python 3.10, `python app.py`). Treat a push to `main` as an ML deploy. Deploy order is ML service, then Node, then client.

## Running locally

Copy `server/.env.example` and `ml-service/.env.example` to `.env` and fill them in. The client needs `client/.env` with `REACT_APP_API_URL=http://localhost:5000`. `INTERNAL_API_KEY` must be identical in the server and ml-service `.env` files. `README.md` → "Local Setup" has the full variable list.

| Service | Directory | Command | Port |
|---|---|---|---|
| ML service | `ml-service/` | `python -m venv venv`, activate it, `pip install -r requirements.txt`, `python -m spacy download en_core_web_sm`, then `python app.py` | 8000 |
| Node API | `server/` | `npm install`, then `node server.js` (run it from `server/`, because multer writes to a relative `uploads/`) | 5000 |
| Client | `client/` | `npm install`, then `npm start` | 3000 |

The venv lives at `ml-service/venv` (git-ignored). On Windows activate it with `venv\Scripts\activate`; on macOS/Linux use `source venv/bin/activate`. Google sign-in needs a real OAuth client, with the local callback URL registered in Google Cloud Console.

## Tests

Run from the repo root unless noted.

```bash
# ML service (the venv's Python must be the one that runs this)
python -m unittest discover -s ml-service -p "test_*.py"

# Node
cd server && npm test

# Client (bash shown; in PowerShell use: $env:CI="true"; npx react-scripts test --watchAll=false)
cd client && CI=true npx react-scripts test --watchAll=false
```

Before finishing client work, also run `npm --prefix client run build`.

Test layout gotchas:
- **Node tests** (`server/security.test.js`, `server/jd-match.test.js`) run `server.js` inside a `vm` context. External modules (`express`, `mongoose`, `axios`, the models, `protect`) are replaced with mocks, and the HTTP behaviour is exercised with real Express, multer and rate-limit middleware. A new `require` in `server.js` or a new model needs a matching mock in those tests. The `npm test` script lists test files explicitly (`node --test security.test.js jd-match.test.js`), so a new test file must be added to `server/package.json`.
- **Route coverage tests walk the route tables**, so new routes are checked automatically. `server/routes.test.js` requires every Express route except `GET /` to have `protect` as its first handler and to return JSON 401 without a token. A route whose handler calls `axios` must have a per-user rate limiter as its second handler, or be added to `NO_USER_LIMIT` with a reason. It also pins the `{ userId, <sort field> }` indexes. `ml-service/test_security.py` reads Flask's `url_map` and requires `X-Internal-Key` on everything except `/health`.
- **ML tests** (`ml-service/test_*.py`) avoid loading spaCy and Gemini. `test_security.py` extracts route functions from `app.py` with `ast` and stubs the heavy dependencies, and `test_llm.py` mocks the SDK. Keep new routes loadable that way and mock `llm.generate` instead of calling Gemini.
- **Client tests** use Testing Library with mocked axios (`App.test.js`, `components/shell/shell.test.jsx`, `components/ui/ui.test.jsx`, `CareerAgent.test.jsx`, and a `*.test.jsx` next to each page). Tests that render the shell or the coach must let their background requests settle inside `act()`. `CareerAgent` fetches `/api/dashboard/summary` on mount, so its tests mock `axios.get` too. `setupTests.js` polyfills `TextEncoder`, which jsPDF needs at import time.
- **Large nested request bodies** (resume drafts) use a validator module shared with the Mongoose schema (`server/lib/resumeBuilder.js`), so the limits are defined once.
- **ML modules with LLM logic** (for example `roadmap.py` and `resume_builder.py`) take `generate` as a parameter and avoid importing spaCy, so they can be unit tested directly with a fake LLM.
- Express routes run inside a `vm` context in the Node tests, so objects they build have other-realm prototypes. Compare them with `JSON.stringify` rather than `assert.deepEqual`.

## Backend conventions (already used in the code; follow them)

**Express routes (`server/server.js`)**
- Every route that touches user data uses the `protect` middleware (Bearer JWT, loads `req.user`). `/` and the OAuth routes are the only public ones, and `/api/auth/me` verifies the token itself.
- Scope every query to the caller: `Model.find({ userId: req.user._id })`, `findOneAndDelete({ _id, user: req.user._id })`. Never query by ID alone.
- A missing ID and another user's ID return the same 404, so ownership cannot be probed. A malformed ObjectId returns 400 (`/^[a-f\d]{24}$/i`) before any DB call. `DELETE /api/jd-match/:id` does this. The older `DELETE /api/history/:id` doesn't, so don't copy it.
- Expensive routes get a per-user `express-rate-limit` (`keyGenerator: (req) => String(req.user._id)`, 20 requests per 15 minutes). Place it after `protect` so `req.user` exists. See `jdMatchLimit`, `chatLimit`, `roadmapLimit` (10 requests), `enhanceLimit` (30), `resumeScoreLimit` (120), `interviewStartLimit` (10) and `interviewAnswerLimit` (40). All of `/api` also has a 300 per 15 minutes per-IP limiter. `/upload` sits outside `/api` and has neither limiter today, which is a known gap, so don't copy it. Counters are in memory per process.
- Request bodies are validated by hand and strictly:
  - Reject non-objects and arrays.
  - Reject unknown keys with a whitelist.
  - Check types and non-blank strings.
  - Enforce explicit length limits, counting code points (`[...str].length`): chat message 2000, user history item 2000, assistant history item 16000, JD text 8000, JD title 120, target role 100, resume text stored at 50000.
  - Malformed payloads return 400 and over-limit payloads return 413.
  - Uploads: one PDF, MIME type and extension checked, `%PDF-` signature checked, 5 MiB cap, temp file removed in `finally`.
- Errors returned to the browser are sanitised:
  - Return a generic message (`"Analysis failed"`, `"JD matching unavailable"`, `"Internal server error"`) and log only `err.message` server-side.
  - Never forward upstream error bodies. The one exception is the shared allowlist of known-safe ML messages, `SAFE_AI_ERRORS` in `server.js`.
  - Map upstream 400/413/429 through and everything else to 503. Use 500 for database failures.
  - The final Express error handler converts multer, body-size and JSON-parse errors into clean JSON.
- Shape of error JSON: new routes use `{ error: "..." }`. The older `/api/history` and `protect` responses use `{ message: "..." }`. Use `{ error }` for new code and don't rewrite the old routes unless asked.
- Calls to Flask: `axios.post(`${ML_URL}/...`, body, { headers: internalHeaders(), timeout })`, with 60 s for `/analyze`, 30 s for chat and JD match, 10 s for health, and `LLM_RETRY_TIMEOUT` (90 s) for routes whose Flask side validates LLM output and retries once (roadmap, resume enhance, interview questions and evaluate). Validate the shape of Flask's response before saving or returning it (`/api/jd-match` checks score range, verdict enum, and string arrays).
- Mongoose: set `maxlength` and validators in the schema as a second line of defence. Sensitive or large fields use `select: false` (`Analysis.resumeText`, loaded only with `.select("+resumeText")`). Newer models use `userId` plus a `{ userId: 1, createdAt: -1 }` index (`JDMatch`). `Analysis` uses `user`, which is older.

**Flask (`ml-service/app.py`)**
- Route bodies are parsed with `request.get_json(silent=True)` and validated for exact key sets, types, non-blank strings and length limits. Failures return a JSON error with 400 or 413. `MAX_CONTENT_LENGTH` is 5 MiB.
- JSON error handlers cover 413, `HTTPException` and bare `Exception` (logged, returned as `"Internal server error"`), so no stack trace reaches the caller.
- Compare keys with `hmac.compare_digest`. Keep `/health` as the only unauthenticated route.
- Scoring (`/jd-match`) is deterministic and uses no LLM. The weights are `JD_TEXT_WEIGHT` and `JD_SKILL_WEIGHT`. Changing `extract_features()` or the training tiers requires `POST /retrain`.

**LLM calls**
- Every LLM call goes through `ml-service/llm.py`: `generate(system_prompt, messages, json_mode=False, max_output_tokens=1024) -> str`. Never import or call the Gemini SDK (`google.genai`) anywhere else.
- `messages` is a non-empty list of exactly `{role: "user"|"assistant", content: non-blank str}`. The system prompt is always server-owned. Clients send conversation text only, never a system role or prompt.
- `generate` raises `LLMError` with a safe, user-facing message and `ValueError` for bad arguments. Routes catch `LLMError` and return its message with 503, and catch any other exception with a generic 503 (`"Agent unavailable"`). If you add a new safe message in `llm.py` or a route, add it to Node's `SAFE_AI_ERRORS` allowlist, or it is replaced by the generic text.
- JSON mode (`json_mode=True`) only guarantees that the returned string parses as JSON, with one repair retry. It does not check the structure. Callers must schema-validate the parsed result (required keys, types, enums, bounds, list lengths) and treat a failure as a 503-class error. Never trust or pass through raw model JSON. Cap `max_output_tokens` to what the feature needs.
- Treat resume text, JD text and chat history as untrusted data inside prompts, not as instructions. State this in the system prompt, as `/agent/gap` does.

## UI conventions

**Design system** (rationale and audit: `docs/redesign/PLAN.md`)
- **Tokens:** defined in `client/src/index.css` (`:root`) and mirrored in `client/tailwind.config.js`.
  - Surfaces: page `#F7F8FA` (`bg-page`), white cards (`bg-surface`), 1px `#E4E7EC` borders (`border-line`), 10px radius (`rounded-card`), `shadow-card`.
  - One brand colour, teal: `brand` `#0F766E`, hover `#115E59`, tint `#F0FDFA`. Text greys are `ink` `#101828`, `ink-secondary` `#344054` and `ink-muted` `#667085`; nothing lighter is used for text.
  - Semantic colours only for meaning: `success`, `warning` and `danger`, each with a `-tint`.
  - Every text/background pair meets WCAG AA; check new pairs with `docs/redesign/tools/contrast.mjs`.
- **Type:** Inter, self-hosted through `@fontsource/inter` (400/500/600) and imported in `index.js`.
  - The Tailwind scale is limited to `text-xs` 12 / `sm` 14 / `base` 16 / `lg` 20 / `xl` 24 / `2xl` 30, with weights `normal`/`medium`/`semibold`.
  - Use `.tabular` for scores. Uppercase is for table headers only.
  - Serif appears only inside the resume preview (`--font-serif-document`), because it mirrors the PDF.
- **Icons:** lucide-react through `components/ui/Icon` (16px, or 20px in navigation; stroke 1.75). Never use emoji as icons. Role icons and labels come from `constants/targetRoles.js` (`ROLES`, `roleLabel`, `roleIcon`).
- **Components:** use `components/ui` instead of one-off styles. It provides:
  - `Button` (primary, secondary, ghost, danger; sm or md), `Card`, `Badge`, `PageHeader`
  - `ScoreRing` (warning below 50%, success at 75%+), `ProgressBar`, `Tabs`/`TabPanel`
  - `Input`, `Select`, `Textarea` (code-point counter), `Tooltip`
  - `EmptyState`, `Skeleton`, `LoadingState` (adds the cold-server notice after 8 s), `InlineAlert`
  - Display helpers live in `utils/format.js` (`formatSkill`, dates) and `utils/skillGroups.js`.
- **Page rules:** every page has a `PageHeader` and at most one primary button. Use `LoadingState` while loading, `EmptyState` (icon, one sentence, one action) when there is nothing to show, and `InlineAlert` for errors; never `alert()`.
  - Copy is short, plain and in sentence case, without exclamation marks. Button labels start with a verb.
  - Motion is limited to 150ms colour transitions, and `prefers-reduced-motion` is respected.
- **Two layout traps** (both were real bugs):
  - A `hidden` attribute is overridden by a display utility such as `flex`, so set the display class from the same state.
  - An `sr-only` element inside a horizontally scrolling container needs a `relative` container, or it widens the whole page.
- **Visual check:** `docs/redesign/tools/capture.mjs` screenshots every page from the production build with mocked API data and flags horizontal scroll and overflowing text.

**Navigation is state-based, not router-based**
- `App.js` (`AppInner`) holds `currentPage` in `useState` and renders the page with `{currentPage === "x" && <X onNavigate={navigate} />}`. `navigate(page, data)` sets the page and scrolls to top. `compare` receives its data through `compareData`. Every other `data` object goes into `pageData`, which each navigation replaces, and is passed as a one-shot `preset`. Examples: `{ analysisId, targetRole }` or `{ analysisId, jdMatchId }` for Roadmap; `{ analysisId, role }` or `{ jdMatchId, jdTitle }` for Interview; `{ file }` as UploadResume's `presetFile`. Pages read it once through a ref and only pre-select; they never auto-run AI calls.
- Signed-out users see the landing page. Signed-in users see `AppShell` (`components/shell/`) wrapped in `AppDataProvider`. The shell is:
  - a grouped left sidebar, 240px wide and collapsible to a 64px icon rail; it becomes a modal drawer below 1024px;
  - a top bar with the breadcrumb, a "New analysis" button and the Career Coach toggle;
  - the Career Coach as a right-hand panel.
  A returning user is auto-sent from `home` to `dashboard`. The OAuth return is detected from `?token=` or `?auth_error=` in `useState`'s initializer.
- To add a page: create it in `client/src/pages/`, import it in `App.js`, add its `currentPage` branch, and add an item to `NAV_GROUPS` in `components/shell/navigation.js`. That file also defines the breadcrumb, and `shell.test.jsx` pins the groups. Pages take `onNavigate` and use `useAuth()` from `context/AuthContext`.
- `AppDataProvider` (`context/AppDataContext.jsx`) loads `GET /api/history` once and shares it with the Dashboard, ProgressTracker and the coach. Use `useAppData()`; outside the provider it fetches on its own. The Analyze page publishes fresh results to the coach with `setCoachAnalysis`.

**API calls from pages**: `const API = process.env.REACT_APP_API_URL || "http://localhost:5000"`, axios, and `headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }`. Show a friendly message from `error.response?.data?.error` with a safe fallback, and mirror the server's limits in the UI (for example the 8000 character JD cap).

## Planned modules

Not built yet. Each needs its own phase, so don't start one unless asked. They should reuse the conventions above: `protect`, per-user scoped queries and rate limits, strict body validation, sanitised errors, `llm.generate` for any LLM step with schema-validated JSON, a state-navigated page and a sidebar entry in `components/shell/navigation.js`. The static designs in `docs/ui-reference/` predate the redesign, so take only the layout ideas from them and build with `components/ui` and the design tokens above.

| Module | Reference design | Notes |
|---|---|---|
| Career Roadmap | `docs/ui-reference/roadmap.html` | **Built.** `ml-service/roadmap.py` + Flask `/roadmap`, `server/models/CareerRoadmap.js` + `/api/roadmap*` routes, `client/src/pages/Roadmap.jsx`. Use it as the template for the other modules. |
| AI Resume Builder | `docs/ui-reference/builder.html` | **Built.** `ml-service/resume_builder.py` + Flask `/resume/enhance` and `/resume/score`, `server/lib/resumeBuilder.js` (shared draft limits/validation) + `server/models/ResumeDraft.js` + `/api/resume-builder/*`, `client/src/pages/ResumeBuilder.jsx` with `client/src/utils/resumeDraft.js` and `resumePdf.js`. |
| Job & Internship Recommendations | `docs/ui-reference/jobs.html` | **Will not be built** (decided during the 2026-11 redesign). Keep it out of the sidebar, KPIs and copy. |
| Interview Prep with AI Feedback | `docs/ui-reference/interview.html` | **Built.** `ml-service/interview.py` + Flask `/interview/questions` and `/interview/evaluate`, `server/lib/interview.js` (shared limits, project-title extraction, feedback validation) + `server/models/InterviewSession.js` + `/api/interview/*`, `client/src/pages/InterviewPrep.jsx`. The overall score is recomputed from the rubric in Flask and Node; never trust the model's. |
