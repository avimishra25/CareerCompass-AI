# Redesign: before and after

Before: `docs/redesign/before/NN-name-WIDTH.jpg`. After: `docs/redesign/after/name-WIDTH.jpg`.

Both sets come from the production build with the same mocked data, by `docs/redesign/tools/capture.mjs`. The
only difference is that the sample user is now "Rahul Verma". Clean 1440px PNGs for the report and slides are
in `docs/screenshots/`.

## Overall

| | Before | After |
|---|---|---|
| Colours | 124 distinct (38 hex, 86 rgba), several blues and indigos | One teal brand, one grey scale, three semantic colours with tints |
| Font sizes | 39 values, some as small as 9.3px | 6 (12 / 14 / 16 / 20 / 24 / 30), enforced in `tailwind.config.js` |
| Fonts | Plus Jakarta Sans plus italic Instrument Serif accents, from Google Fonts | Inter only, self-hosted; serif only inside the resume preview |
| Icons | 44 emoji used as icons | lucide-react; 0 emoji in the client |
| Surfaces | Translucent glass cards, blur, gradient mesh and noise background | White cards, 1px border, 10px radius, flat page |
| Buttons | Gradient blue/indigo; several primaries per screen | `Button` component; at most one primary per page |
| Contrast | Muted text 2.75:1, success text 2.54:1, warning text 2.15:1 | Every text pair ≥ 4.5:1 (`tools/contrast.mjs`) |
| Navigation | 8-link top bar | Grouped sidebar (collapsible, a drawer below 1024px), breadcrumb top bar, coach as a side panel |
| Loading, empty and error states | Spinners, blank areas, `alert()` | Skeletons (plus a cold-server notice after 8 s), empty states with an action, inline alerts |
| Layout audit | Not measured | 15 screens × 4 widths (1440 / 1024 / 768 / 390): no horizontal scroll and no clipped text |

## Page by page

| Screen | Before | After |
|---|---|---|
| **Landing** (`01-landing` → `landing`) | Gradient hero with serif accents, an uppercase badge, emoji chips, invented stats ("200+ skills"), and large empty bands between sections | One headline and one sentence, one primary "Continue with Google", a real dashboard screenshot, three feature blocks, and a team footer |
| **Dashboard** (`02` → `dashboard`) | 8 equal stat tiles, a fake "sample result preview", 9 marketing cards and duplicate quick links | Greeting with one contextual action; 4 KPIs (ATS with change, roadmap progress, readiness, best JD match); "Continue where you left off"; a single-line progress chart |
| **Resume analysis** (`03`, `04` → `analyze-empty`, `analyze-results`, `analyze-match`) | One long page: target banner, nested ATS card, every skill as a pill, all 12 roles each with a missing list | "Your next step" card; a summary row (score ring, role match, skills, file); tabs for Overview, Skills (grouped, 12 then "+N more") and Career match (target and top 3, "Show all") |
| **Career coach** (`05` → `career-coach`) | Floating bubble, only on the analysis page; raw asterisks in replies | Side panel on every page that uses the latest analysis, roadmap and interview context; replies render markdown safely |
| **History** (`06` → `history`) | Tall cards with custom checkboxes; at the time of the production check, cards were invisible (opacity 0) | Table with real checkboxes, ATS badges, role icons and inline delete confirmation; "Compare selected" is the one primary action |
| **Compare** (`07` → `compare`) | Click order decided A/B, so improvements could read as declines; three delta cards and gradient bars | Always older → newer; one aligned table with a highlighted change column (green up / red down); skills gained / kept / removed |
| **JD match** (`08` → `jd-match`) | Unstyled native form, verdict as plain text | Same structure, restyled: labelled fields, the 8000-character counter, score ring, verdict badge, skill badges, history rows with inline delete |
| **Roadmap** (`09` → `roadmap`) | Truncated selects, every week a full card, six weeks titled "rest api" for a single gap | Full-width form; timeline with status icons, the current week highlighted, finished weeks collapsed; "Skill: subtopic" titles; at most 2 weeks per gap; "You cover this role" empty state |
| **Resume builder** (`10` → `resume-builder`) | Pill tabs, emoji buttons, a suggestion list, a preview that changed height | Section stepper with completion state; before → after suggestion card (Accept / Edit / Regenerate / Discard); a fixed A4-proportion preview, sticky on wide screens |
| **Interview prep** (`11`, `12` → `interview-question`, `interview-feedback`) | At 390px the question sat below the form, list and readiness card; truncated selects | Question rail with readiness on desktop; on phones a compact stepper, then the question first; feedback uses the shared score ring and progress bars |
| **About** (`13` → `about`) | Serif accents, a gradient CTA, and libraries the code does not use (bcrypt, Nodemailer) | What it does, how scoring works (with the synthetic-data caveat), the actual stack, and the builder credit |
| **Profile** (`14` → `profile`) | Gradient avatar, glass cards | Account card and a danger "Log out" |
| **Mobile menu** (`15`) | Dropdown under the top bar | Modal drawer with focus trap and Esc to close (`dashboard-390-drawer` in the review previews) |

## Functional fixes made during the redesign

- **History:** cards were invisible in production (inline `opacity: 0` left over from a removed animation). A test now fails on that.
- **Roadmap:** plans are capped at 2 weeks per gap; each week has a subtopic title; repeated titles are rejected in Flask and Node.
- **Coach:** markdown is rendered as elements, never HTML. The closed panel is hidden in real browsers (a `flex` class had overridden `hidden`). Errors are no longer sent back to the model as assistant turns.
- **Compare:** the order no longer depends on click order.
- **Layout:** screen-reader-only labels inside horizontally scrolling tables and steppers no longer widen the page at 390px.

## How to reproduce

```bash
# Outside the repo, once: npm install playwright-core@1.56.1, then copy docs/redesign/tools/* next to it.
cd client && CI=true npm run build && cd ..
node capture.mjs client/build out --widths=1440,1024,768,390      # prints "ok" or "ISSUE ..." per screen
node capture.mjs client/build shots --widths=1440 --png --only=dashboard,analyze-results,jd-match,roadmap,resume-builder,interview-feedback
```

Full-page captures show the fixed sidebar ending at the viewport height. That is how a fixed element looks in a
full-page screenshot, not a layout bug.
