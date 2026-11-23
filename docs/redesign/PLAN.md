# CareerCompass AI frontend redesign: audit and plan

Status: **Done** (see `docs/redesign/CHANGES.md`). Approved Decisions are recorded in the next section; they override anything later in this file
that conflicts with them.

## Decisions (approved)

1. **Jobs is out of scope and will not be built.** It is left out of the sidebar, the KPIs and everything
   else. "Prepare" contains only Interview prep. The fourth KPI is **Best JD match**. The third
   "Continue where you left off" row is the **latest resume draft**.
2. The Dashboard also uses the existing `GET /api/history`, `GET /api/interview/history` and
   `GET /api/resume-builder/drafts`. The history call is shared with ProgressTracker and the Career Coach.
3. The serif font stays inside the resume preview only, because it mirrors the exported PDF.
4. Inter is self-hosted through `@fontsource/inter` (400/500/600), falling back to the system stack.
   There is no Google Fonts request.
5. The work happens on branch `redesign/product-ui`, which is not pushed until asked.
6. The About page builder card reads "Built by Avi Mishra."
7. Step 5 also saves clean 1440px PNG screenshots to `docs/screenshots/` for the report and slides, with
   the fixture user renamed to "Rahul Verma":
   - Dashboard
   - Resume analysis results
   - JD match
   - Roadmap
   - Resume builder
   - Interview feedback

Scope: visual and UX only. No API calls, routes, response shapes, server or ML code change. Every existing feature
keeps working, and every existing test assertion keeps its meaning (only selectors that depend on removed emoji or
markup are updated). See "Decisions I need from you" at the end before I start Step 2.

---

## 1. How the audit was done

- **Screenshots:** `docs/redesign/before/` has 29 full-page captures: 14 screens at 1440px and 390px, plus the
  390px nav menu. They are JPEG at quality 85, 3.6 MB in total; PNG would have been 15.6 MB for this set alone.
- **Capture setup:** `docs/redesign/tools/capture.mjs` drives the production build in Chrome through Playwright.
  - API calls are answered with realistic fixtures (`fixtures.mjs`, shaped like the Node responses). No backend
    or database is needed.
  - Navigation uses the real UI: nav clicks, uploading a PDF, selecting two analyses for Compare, opening a JD
    match and an answered interview question.
  - The same script produces the "after" set in Step 5.
- **Style inventory:** `tools/inventory.mjs` scans all non-test files in `client/src`. The full list, with each
  value's use count and files, is in `docs/redesign/INVENTORY.md`.
- **Contrast:** `tools/contrast.mjs` computes WCAG 2.x ratios for the current and proposed palettes.

| # | Screen | 1440px | 390px |
|---|---|---|---|
| 01 | Landing (signed out) | `01-landing-1440.jpg` | `01-landing-390.jpg` |
| 02 | Dashboard | `02-dashboard-1440.jpg` | `02-dashboard-390.jpg` |
| 03 | Resume analysis, before upload | `03-analyze-empty-1440.jpg` | `03-analyze-empty-390.jpg` |
| 04 | Resume analysis, results | `04-analyze-results-1440.jpg` | `04-analyze-results-390.jpg` |
| 05 | AI Career Coach open | `05-career-coach-1440.jpg` | `05-career-coach-390.jpg` |
| 06 | History | `06-history-1440.jpg` | `06-history-390.jpg` |
| 07 | Compare | `07-compare-1440.jpg` | `07-compare-390.jpg` |
| 08 | JD Match with a result | `08-jd-match-1440.jpg` | `08-jd-match-390.jpg` |
| 09 | Roadmap | `09-roadmap-1440.jpg` | `09-roadmap-390.jpg` |
| 10 | Resume Builder | `10-resume-builder-1440.jpg` | `10-resume-builder-390.jpg` |
| 11 | Interview Prep, open question | `11-interview-question-1440.jpg` | `11-interview-question-390.jpg` |
| 12 | Interview Prep, feedback | `12-interview-feedback-1440.jpg` | `12-interview-feedback-390.jpg` |
| 13 | About | `13-about-1440.jpg` | `13-about-390.jpg` |
| 14 | Profile | `14-profile-1440.jpg` | `14-profile-390.jpg` |
| 15 | Navigation menu (mobile) | – | `15-mobile-menu-390.jpg` |

Not captured: the OAuth hand-off and sign-in error screens (one line of text each), and loading/error states.
Those are listed per page below.

---

## 2. Inventory

### Pages (`client/src/pages`, 13 files) and what they render

| Page | Lines | Contents today |
|---|---|---|
| `App.js` shell | 168 | Signed-out landing (hand-built top bar + Hero + AuthPage + Stats + Features + footer); signed-in Navbar + page switch on `currentPage` |
| `Dashboard.jsx` | 236 | Greeting card, 8 stat buttons, 3 quick-action cards, ProgressTracker, "sample result preview" (static fake data), 9 feature cards, 4 quick links, footer |
| `UploadResume.jsx` (Analyze) | 422 | Target-role select, drop zone, Analyze button, PDF download, target-role banner, `ATSReport`, next-steps bar, skills card (all skills as pills), career match (all 12 roles), floating `CareerAgent` |
| `History.jsx` | 244 | Cards per analysis with custom checkbox, ATS, top role, skills; compare button; `alert()` on delete failure |
| `Compare.jsx` | 354 | Three delta cards, A/B cards, gained/retained/removed skills, role-match bars |
| `JDMatch.jsx` | 122 | Native-styled form (no design-system inputs), gauge, verdict text, four pill lists, next-steps buttons, history list |
| `Roadmap.jsx` | 236 | Form (4 fields + button), 3 summary cards, timeline of every week as a full card |
| `ResumeBuilder.jsx` | 529 | Draft picker, section tabs as pills, section editor, enhance panel, live score card, serif preview, save/export |
| `InterviewPrep.jsx` | 385 | Setup form, question list, readiness card, question card with answer box, feedback panel |
| `About.jsx` | 131 | Hero, "how it works", modules, tech stack, builder bio, CTA |
| `Profile.jsx` | 69 | User card, sign-out card |
| `AuthPage.jsx` | 56 | "Continue with Google" card |
| `OAuthSuccess.jsx` | 34 | Spinner while the token is exchanged |

### Shared components (`client/src/components`)

`Navbar` (top bar, 8 links), `Hero`, `Stats` (landing, partly invented figures), `Features`, `ATSReport` (342 lines,
also exports `Gauge`), `CareerAgent` (379 lines, floating chat), `ProgressTracker` (recharts, 2 charts). There are
no shared Button, Card, Input or Badge components: every page restyles them inline.

### Styles in use (full detail in `INVENTORY.md`)

| What | Distinct values | Uses | Notes |
|---|---|---|---|
| Hex colours | 38 | 229 | Two blues, two indigos, teal, rose, several greens and ambers chosen ad hoc |
| rgba colours | 86 | 196 | Mostly translucent tints of the blue/indigo for glass and pills |
| CSS variables | 11 | 204 | `--text`, `--text-2`, `--text-3`, `--blue`… from `index.css` |
| Font sizes | 9 Tailwind + 30 inline + 2 CSS | 348 | Inline values include 0.58rem (9.3px), 0.65rem, 0.67rem, 10.5px, 11px, 11.5px, 12.5px |
| Font weights | 5 Tailwind + 5 inline | 162 | 300 to 800; brief allows 400/500/600 only |
| Font families | 4 | 184 | Plus Jakarta Sans repeated inline on ~170 elements; Instrument Serif for italic accents; Georgia/Times in the resume preview |
| Spacing | 17 Tailwind + 41 inline | 630 | Inline values such as `18px 22px`, `10px 12px`, `14px 16px` are off the 4px grid |
| Radii | 7 Tailwind + 13 inline | 187 | From 6px to `rounded-3xl` (24px) and pills |
| Shadows | 12 | 13 | Coloured, blurred, up to `0 20px 60px` |
| Glass (`backdrop-filter`) | 1 | 9 | Plus `.glass` used on almost every card (181 class uses of index.css helpers) |
| Gradients | 3 kinds | 35 | Buttons, text, bars, rings, avatars, page background mesh and noise overlay |
| Emoji as icons | 44 | 96 | Role icons, buttons (🗺️ 🎤 ✨ 📥 💾), headings, empty states |
| Uppercase / letter-spaced labels | 4 | 48 | Micro-labels at 11px throughout |

Other findings: `index.html` title is still "React App", `App.css` is unused CRA boilerplate, and `logo.svg` is unused.

### Contrast (WCAG 2.x)

| Current pair | Ratio | Result |
|---|---|---|
| Muted text `#8892b4` on page `#f0f2f7` | 2.75:1 | **Fails** (used for most labels and hints) |
| Muted text `#8892b4` on white | 3.08:1 | Fails for body text |
| Link blue `#3b6ef8` on page | 3.93:1 | Fails for body text |
| White on gradient buttons `#3b6ef8`→`#6c63ff` | 4.32–4.40:1 | Fails for 14px button text |
| Success green `#10b981` on white | 2.54:1 | **Fails** |
| Warning amber `#f59e0b` on white | 2.15:1 | **Fails** |

Every pair in the proposed palette passes AA. The lowest is muted `#667085` on the hover grey `#F2F4F7` at
4.51:1, so muted text will not be placed on hover-grey backgrounds. Brand white-on-teal is 5.47:1, and the
semantic colours on their tints are 5.20–6.05:1.

---

## 3. Problems seen in the screenshots (what the redesign must fix)

1. **Look:** pastel radial mesh plus a noise overlay, and translucent cards everywhere. Gradient buttons, text and
   bars; italic serif accent words ("Career *Roadmap*"); emoji icons. It reads as a template.
2. **Hierarchy:** every element is a card of the same weight. Dashboard has 8 equal stat tiles, 3 action cards, a
   *fake* "sample result preview", 9 feature cards and 4 quick links, so the real data is buried.
3. **Analysis results** are one long page: a target banner, an ATS card with nested sub-cards, a next-steps bar,
   *all* skills as pills, and all 12 roles each with a missing-skills line. There is no single "do this next".
4. **Navigation:** an 8-link top bar that collapses at 1024px; no grouping. The Career Coach is a floating bubble
   that only exists on the analysis page.
5. **Mobile (390px):** Interview Prep puts the actual question *below* the setup form, the 5-question list and
   the readiness card. History cards and Compare's three delta cards stack into very tall pages.
6. **Landing:** large empty bands between sections (from `min-h-screen` wrappers) and invented stats
   ("200+ skills detected", "3 service architecture").
7. **Compare:** A/B follows click order, so picking the newer resume first shows improvement as a decline
   ("72 → 64 ▼8"). Presentation-only fix: always order the pair oldest → newest.
8. **Roadmap form:** select labels are truncated at 1440px ("Fullstack Devel…"); every completed week is a full card.
9. **Loading and errors:** spinners, or nothing; an `alert()` on History delete; inconsistent error colours.
10. **Focus:** no visible focus style on most custom buttons; custom checkboxes are buttons without a checkbox role.

---

## 4. Design system (Step 2)

### Tokens (`client/src/index.css` `:root`, mirrored in `tailwind.config.js` `theme.extend`)

| Token | Value | Use |
|---|---|---|
| `--page` | `#F7F8FA` | Page background (flat, no mesh) |
| `--surface` | `#FFFFFF` | Cards, sidebar, top bar |
| `--border` | `#E4E7EC` | All 1px borders and dividers |
| `--hover` | `#F2F4F7` | Row and ghost-button hover (no muted text on it) |
| `--text` | `#101828` | Primary text |
| `--text-secondary` | `#344054` | Body copy, labels |
| `--text-muted` | `#667085` | Hints, meta lines; the lightest text colour allowed |
| `--brand` / `--brand-hover` / `--brand-tint` | `#0F766E` / `#115E59` / `#F0FDFA` | Primary actions, links, selection, focus |
| `--success` / tint | `#067647` / `#ECFDF3` | Good scores, done states |
| `--warning` / tint | `#B54708` / `#FFFAEB` | Scores below 50, in-progress risk |
| `--danger` / tint | `#B42318` / `#FEF3F2` | Errors, destructive actions, missing skills |
| `--radius` | `10px` (inputs and badges `6px`, pills `999px` only for Badge) | |
| `--shadow` | `0 1px 2px rgba(16,24,40,.05)` | Cards only; overlays (drawer, tooltip, menu) get `0 8px 24px rgba(16,24,40,.12)` |
| `--focus` | `0 0 0 2px #fff, 0 0 0 4px #0F766E` | `:focus-visible` on every interactive element |
| Motion | `150ms ease` on colour/background/border/opacity only; none under `prefers-reduced-motion` | |

- **Type:** Inter from Google Fonts (400/500/600), falling back to `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
  - Scale: 12 / 14 / 16 / 20 / 24 / 30px, mapped to Tailwind `text-xs` … `text-3xl` in the config so no other
    size can be used.
  - Body text is 14px, page titles 24px, and the landing headline 30px.
  - Scores use `font-variant-numeric: tabular-nums` (a `.tabular` utility).
  - Uppercase is used only for table header cells (12px, 500 weight, 0.02em tracking).
- **Spacing:** Tailwind's 4px scale only; no arbitrary pixel values.
  - Page padding: 24px desktop, 16px mobile.
  - Section gap: 24px; card padding: 20px (16px on mobile); gap inside a card: 12–16px.
- **Removed:** `.glass`, `.glass-dark`, `.gradient-text*`, `.btn-primary`, `.btn-ghost`, `.input-glass`,
  `.skill-pill`, `.progress-*`, `.fade-up*`, the body mesh and noise, the Instrument Serif import, and `App.css`.
  The CLAUDE.md "UI conventions" section is rewritten to match.

### Icons

lucide-react (one new dependency), 16px inline and 20px in nav and empty states, stroke 1.75, through a small
`<Icon>` wrapper that fixes those defaults. Role icons live in `client/src/constants/targetRoles.js`, so the 12
roles render the same everywhere. The emoji in the `label` field are dropped.

| Role | Icon | Role | Icon |
|---|---|---|---|
| Fullstack developer | `Layers` | Mobile developer | `Smartphone` |
| Frontend developer | `LayoutTemplate` | Cloud architect | `Cloud` |
| Backend developer | `Server` | Cybersecurity analyst | `ShieldCheck` |
| Data scientist | `ChartLine` | UI/UX designer | `PenTool` |
| DevOps engineer | `Workflow` | Database administrator | `Database` |
| ML engineer | `BrainCircuit` | Blockchain developer | `Blocks` |

### Components (`client/src/components/ui/`)

| Component | API sketch | Notes |
|---|---|---|
| `Button` | `variant: primary \| secondary \| ghost \| danger`, `size: sm \| md`, `icon`, `loading` | 32px / 36px tall; `loading` keeps width and disables |
| `Card` | `as`, `padding`, optional `header` (title, description, actions) | White, 1px border, 10px radius, subtle shadow |
| `Badge` | `tone: neutral \| success \| warning \| danger \| brand`, `icon` | 12px, 500 weight, tint background |
| `ScoreRing` | `value`, `max` (100 or 10), `size`, `label` | Single colour: brand; warning below 50%, success at 75%+; `role="img"` with a text label |
| `ProgressBar` | `value`, `max`, `tone`, `label` | 6px track `#EAECF0`; `role="progressbar"` |
| `Tabs` | `tabs`, `value`, `onChange` | WAI-ARIA tabs with arrow-key navigation |
| `Select`, `Textarea`, `Input` | label, hint, error, counter (`Textarea`) | Visible label, error text linked with `aria-describedby` |
| `EmptyState` | `icon`, `title`, `description`, `action` | One sentence plus one button |
| `Skeleton` | `lines`, `height`, `rounded` | Pulse animation off under reduced motion |
| `Tooltip` | `content`, child trigger | Shows on hover and focus; `aria-describedby`; Esc closes |
| `PageHeader` | `title`, `description`, `actions` (one primary), optional breadcrumb | |
| `InlineAlert` | `tone`, `title`, `children`, `action` | Replaces `alert()` and plain red text; `role="alert"` for errors |

---

## 5. App shell (Step 3)

- **Sidebar**, 240px wide; it collapses to a 64px icon rail with tooltips, and the setting is remembered in
  `localStorage` as a UI preference only. Below 1024px it becomes a slide-in drawer with a backdrop; the drawer
  closes on Esc or on choosing a page, and focus moves to the first item and back to the menu button on close.
  - **Overview:** Dashboard
  - **Analyze:** Resume analysis, JD match, History
  - **Improve:** Roadmap, Resume builder
  - **Prepare:** Jobs (see decision 1), Interview prep
  - **Bottom:** About; user menu (avatar initial, name, email) with Profile and Log out
- **Keyboard:** the sidebar is a `<nav>` of buttons with `aria-current="page"`, all reachable with Tab; arrow keys
  move within a group. The collapse toggle has an `aria-label`.
- **Top bar**, 56px:
  - Left: a menu button (below 1024px) and the page title, with a breadcrumb for Compare ("History / Compare").
  - Right: a "New analysis" primary button that goes to Resume analysis, and a Career Coach toggle.
- **Career Coach** becomes a right-hand panel: 380px wide, or full screen below 768px. It keeps its existing
  `POST /api/agent/chat` behaviour and context format. On the analysis page it uses that analysis's results;
  everywhere else it uses the latest analysis from `GET /api/history`, an existing call, so the coach is
  available on every page.
- **Navigation stays state-based:** `App.js` keeps `currentPage` and `navigate(page, data)`, and `pageData`
  cross-links keep working. The signed-out landing page has no sidebar.

---

## 6. Page plans (Step 4)

Every page gets a `PageHeader` with one primary action, `Skeleton` loading, an `EmptyState` with an action, and
`InlineAlert` errors. Copy is sentence case, without exclamation marks or hype; buttons are verbs.

| Page | Plan |
|---|---|
| **Dashboard** | Greeting line ("Good afternoon, Riya"); see the KPI and "Continue" rows below. ProgressTracker is restyled: one brand-colour line per chart, light gridlines, no legend dots or dashed lines, tabular axis numbers. The fake "sample preview", the 9 marketing cards and the duplicate quick links are removed. |
| **Resume analysis** | Before upload: the upload card, plus an empty state with a short "what you get" list. After upload: (1) "Your next step" card (rule below); (2) summary row with ATS `ScoreRing`, target-role match %, skills found, file name and date; (3) Tabs: Overview (breakdown bars, "What's working", "Improve here"), Skills (grouped by category, at most 12 per group, then "+N more"), Career match (target role and top 3 as compact rows with icon, name, bar and an expandable "3 missing" badge; the rest behind "Show all 12 roles"). PDF report download stays as a secondary button; the next-steps cross-links become the Next-step card and header actions. |
| **History** | A table: checkbox (real checkbox), file, target role, ATS (badge), top role, date, actions (open in coach, delete with inline confirm). Selecting two enables "Compare". Below 768px rows become stacked cards with the same fields. Delete errors show inline. |
| **Compare** | A breadcrumb back to History. Two aligned columns, older and newer (sorted by date), with a centre Δ column: green arrow up / red arrow down / "no change" in muted text. Rows: ATS score, skills count, best role, each role's match; then skills gained / kept / removed as three Badge lists. |
| **JD Match** | Same structure: form card (analysis Select, title Input, JD Textarea with the existing "N / 8000" counter), result card with `ScoreRing`, verdict `Badge` (Strong = success, Fair = warning, Weak = danger), and four labelled Badge groups. Next-step buttons, then history as compact rows. |
| **Roadmap** | Form fields in a full-width grid (no truncation). Summary row (weeks, progress bar, gaps remaining). Vertical timeline: status icon (`CircleCheck` / `CircleDot` / `Circle`); the current week (first not done) expanded and highlighted with a brand border; completed weeks collapsed to one line and expandable; upcoming weeks show objective, resources and mini-project. The status change stays one click, as a Button with a text label. |
| **Resume builder** | Left: section stepper (number or check icon, label, completion state, current step highlighted). Centre: section editor. Right: a sticky live ATS card and the preview, with a fixed minimum height so the pane doesn't jump while scoring. The AI suggestion becomes an inline diff card: "Your notes" (muted, struck-through style), then "Suggestion" (each bullet with a brand left border), then Accept / Edit / Regenerate / Discard. The serif preview stays (decision 3). |
| **Interview prep** | The setup form collapses to one toolbar row; "Start new session" is the primary action. Desktop: a narrow left rail with Q1–Q5 (status icon and score) and the readiness figure; the main column holds only the current question, answer box, voice button and Submit. Feedback uses `ScoreRing` (out of 10) and five `ProgressBar`s, then strengths / improve / outline. At 390px the question comes first and the question list becomes a compact horizontal stepper. |
| **About** | Plain product page: what it does (three modules, lucide icons), how scoring works (with the "heuristic, not a real ATS" caveat), tech stack as a simple two-column list, builder card. No fake numbers. |
| **Profile** | A `Card` of account details (name, email, sign-in method) and a danger-zone row with a "Log out" danger button. |
| **Landing** | A simple top bar: logo and "Continue with Google". A 30px headline ("See where your resume stands, and what to do next"), a one-sentence value line, and the primary "Continue with Google" button. Then a real screenshot of the new dashboard (captured from fixtures in Step 5 and saved as `client/public/product-dashboard.jpg`), three feature blocks with lucide icons (Analyze, Improve, Prepare), and a footer. The `Stats` component and the gradient hero are deleted. |
| **Jobs** | See decision 1. |

**Dashboard KPIs (4 cards):**
1. **ATS score:** latest value, with the change since the previous analysis.
2. **Roadmap progress:** % done, with a progress bar.
3. **Interview readiness:** /10, with the change.
4. **Best job fit:** see decision 1.

**"Continue where you left off":** up to three rows, each with an icon, one line of text and a button:
- the roadmap's next milestone
- an unfinished interview session
- a saved job; until Jobs exists, the latest resume draft takes this slot (decision 2)

**"Your next step" rule** (deterministic, from data already in the upload response):
1. If ATS < 60 and `improve_here` has a tip, show that tip as a resume fix, with "Open resume builder".
2. Else, if the target (or best) role has missing skills, show "Build a roadmap for N missing skills".
3. Else show "Practise an interview for {role}".

**Copy examples:**
- "Analyze My Resume →" → "Analyze resume"
- "✨ Enhance with AI" → "Improve with AI"
- "🗺️ Build my roadmap" → "Build roadmap"
- "Hey, Riya 👋" → "Good afternoon, Riya"
- "Decent ATS score. A few improvements will significantly boost your visibility." → "Good score. Two changes would raise it most."

---

## 7. Responsive and quality checks (Step 5)

- **Widths:** 1440, 1024, 768 and 390px for every screen. Checks: no horizontal page scroll, no overlap or
  truncation of labels (truncation only for file names, with a tooltip), and tables either scroll inside their
  card or stack.
- **Automated layout check:** the capture script also records `scrollWidth > innerWidth`, plus any element whose
  text overflows its box, per page and width. Results go in CHANGES.md.
- **Contrast check:** `contrast.mjs` is extended to read the token file, so CI-style checking covers every
  text/background pair actually defined.
- **Motion:** `@media (prefers-reduced-motion: reduce)` disables transitions and the skeleton pulse.
- **Tests and build:** all three suites, then `npm run build` with `CI=true` (warnings fail the build).
- **Deliverables:** "after" screenshots in `docs/redesign/after/` with the same file names, and
  `docs/redesign/CHANGES.md` comparing the two sets page by page.

**Test updates:** many queries use emoji button names ("✓ Accept", "🗺️ Build my roadmap", "✨ Enhance with AI").
They will change to the new names, with the same assertions about behaviour, payloads and accessibility roles.
New tests cover the shell: sidebar keyboard navigation, the drawer, the coach panel toggle, Tabs keyboard, and
the next-step rule.

---

## 8. Commit sequence

On a branch, `redesign/product-ui`, not `main`. Each commit passes tests and the build:

1. `docs: redesign audit and plan`: before screenshots, INVENTORY, PLAN, tools
2. `style: design tokens, Inter, Tailwind theme; remove glass/gradient helpers` (temporarily maps old class
   names to the new look, so pages stay usable until each is refactored)
3. `feat(ui): component library in src/components/ui` (with unit tests)
4. `feat(shell): sidebar, top bar, coach panel` → **stop and show you the new Dashboard**
5. One commit per page: dashboard, analysis, history + compare, JD match, roadmap, resume builder, interview,
   about + profile, landing
6. `chore: remove legacy styles and components` (Navbar, Hero, Stats, App.css, unused assets)
7. `docs: after screenshots and CHANGES.md`

---

## Decisions I need from you

1. **Jobs does not exist yet.** The brief asks for a Jobs page, a "best job fit" KPI and "saved jobs". There is no
   Jobs module or API, and this redesign must not add one. Options:
   - **(a) recommended:** show "Jobs" in the sidebar as a disabled item labelled "Soon", use **Best JD match**
     (existing data) as the fourth KPI, and use the latest resume draft instead of saved jobs; or
   - (b) leave Jobs out of the sidebar entirely until the module is built; or
   - (c) build a Jobs page UI with an empty state only (no data, no API).
2. **Dashboard data.** To show "ATS change since last analysis", "unfinished interview" and "latest draft", the
   Dashboard would also call three *existing* endpoints: `GET /api/history`, `GET /api/interview/history` and
   `GET /api/resume-builder/drafts`. No new or changed endpoints. `/api/history` is already loaded on the
   Dashboard by ProgressTracker and will be shared. OK?
3. **Resume preview font.** I plan to keep the serif font *inside the resume preview only*, because it mirrors the
   exported PDF (Times). All app UI moves to Inter. OK?
4. **Inter source.** Google Fonts (as today with Plus Jakarta) or self-hosted via `@fontsource/inter` (no
   third-party request, +~100 KB in the build)? Default: Google Fonts, with the system stack as fallback.
5. **Branch.** Work on `redesign/product-ui` and push it only when you ask. OK, or do you want each commit on `main`?
