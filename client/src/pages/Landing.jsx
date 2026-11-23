import React from "react";
import { Compass, FileSearch, LogIn, MessagesSquare, TrendingUp } from "lucide-react";
import { Button, Icon, cx } from "../components/ui";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const signInWithGoogle = () => { window.location.href = `${API}/api/auth/google`; };

const FEATURES = [
  {
    icon: FileSearch, title: "Analyze",
    text: "Get an ATS score, the skills found in your resume, and how well you match 12 roles or a specific job description.",
  },
  {
    icon: TrendingUp, title: "Improve",
    text: "Turn skill gaps into a week-by-week roadmap, and rewrite resume bullets with suggestions that never invent numbers.",
  },
  {
    icon: MessagesSquare, title: "Prepare",
    text: "Practise interview questions built from your gaps and projects, and get scored feedback on every answer.",
  },
];

// `compact`: below 640px only the mark is shown (the name stays available to screen readers).
function Logo({ compact = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-brand text-white">
        <Icon icon={Compass} />
      </span>
      <span className={cx("whitespace-nowrap text-sm font-semibold text-ink", compact && "sr-only sm:not-sr-only")}>CareerCompass AI</span>
    </span>
  );
}

// Signed-out product page. `onSignIn` is injectable for tests; it defaults to the Google OAuth redirect.
export default function Landing({ onSignIn = signInWithGoogle }) {
  const showFeatures = () => document.getElementById("features")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo compact />
          <Button size="sm" icon={LogIn} onClick={onSignIn}>Continue with Google</Button>
        </div>
      </header>

      <main>
        <section aria-labelledby="landing-title" className="px-4 pb-12 pt-16 text-center sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-2xl">
            <h1 id="landing-title" className="text-balance text-xl font-semibold text-ink sm:text-2xl">
              See where your resume stands, and what to do next
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-ink-secondary">
              Upload your resume to get an ATS score, the skills you are missing for your target role, and a plan to close the gaps.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button variant="primary" icon={LogIn} onClick={onSignIn}>Continue with Google</Button>
              <Button variant="ghost" onClick={showFeatures}>See how it works</Button>
            </div>
          </div>
        </section>

        <section aria-label="Product screenshot" className="px-4 sm:px-6">
          <figure className="mx-auto max-w-5xl overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <img
              src={`${process.env.PUBLIC_URL}/product-dashboard.jpg`} width="1440" height="900" className="block h-auto w-full"
              alt="CareerCompass AI dashboard with ATS score, roadmap progress, interview readiness, recent work and a progress chart"
            />
          </figure>
        </section>

        <section id="features" aria-labelledby="features-title" className="scroll-mt-6 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 id="features-title" className="text-center text-lg font-semibold text-ink">How it works</h2>
            <ul className="mt-10 grid gap-8 md:grid-cols-3">
              {FEATURES.map(({ icon, title, text }) => (
                <li key={title}>
                  <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-control bg-brand-tint text-brand">
                    <Icon icon={icon} size={20} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink-secondary">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl space-y-1.5 px-4 py-8 text-sm text-ink-muted sm:px-6">
          <Logo />
          <p className="pt-2">Built by Avi Mishra.</p>
          <p>© 2026 CareerCompass AI</p>
        </div>
      </footer>
    </div>
  );
}
