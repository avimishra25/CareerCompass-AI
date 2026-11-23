import React from "react";
import { ExternalLink, FileSearch, GraduationCap, Map, MessagesSquare, Target } from "lucide-react";
import { Card, Icon, PageHeader } from "../components/ui";

const STEPS = [
  { icon: FileSearch, title: "Analyze", text: "Upload a PDF. spaCy and TF-IDF extract and rank your skills, a model scores ATS readiness, and you are matched against 12 roles." },
  { icon: Target, title: "Match a job", text: "Paste a job description to see matched, missing and extra skills, scored from text similarity and skill coverage." },
  { icon: Map, title: "Improve", text: "Turn gaps into a week-by-week roadmap, and rewrite resume bullets with AI that rejects any number you did not write." },
  { icon: MessagesSquare, title: "Prepare", text: "Practise interview questions built from your gaps and projects, by text or voice, with rubric-based feedback." },
];

const STACK = [
  ["Frontend", "React 19, Tailwind CSS, lucide-react, Recharts, jsPDF"],
  ["Backend", "Node.js, Express 5, JWT, Google OAuth (Passport), Multer"],
  ["ML and AI", "Python, Flask, spaCy, TF-IDF, scikit-learn gradient boosting, Gemini (google-genai)"],
  ["Data", "MongoDB Atlas with Mongoose"],
  ["Hosting", "Vercel (web), Render (API), Hugging Face Spaces (ML service)"],
];

export default function About() {
  return (
    <>
      <PageHeader
        title="About CareerCompass AI"
        description="A career tool for students: see where your resume stands for a target role, close the gaps, and practise for interviews."
      />
      <div className="space-y-6">
        <Card as="section" title="What it does">
          <ul className="grid gap-5 sm:grid-cols-2">
            {STEPS.map(({ icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-tint text-brand">
                  <Icon icon={icon} size={20} />
                </span>
                <span>
                  <h3 className="text-sm font-semibold text-ink">{title}</h3>
                  <p className="mt-0.5 text-sm text-ink-secondary">{text}</p>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card as="section" title="How scoring works">
            <div className="space-y-3 text-sm text-ink-secondary">
              <p>
                The ATS score comes from a gradient boosting model trained on synthetic resumes. It looks at skills, action verbs,
                quantified results, sections and length, and explains which of these helped or hurt.
              </p>
              <p>
                Treat it as guidance for improving your resume, not as a prediction of any employer's applicant tracking system.
                Role and job matches reflect skills mentioned in your resume, not proven ability.
              </p>
            </div>
          </Card>
          <Card as="section" title="Tech stack">
            <dl className="divide-y divide-line text-sm">
              {STACK.map(([layer, items]) => (
                <div key={layer} className="grid gap-1 py-2 first:pt-0 last:pb-0 sm:grid-cols-[112px_minmax(0,1fr)]">
                  <dt className="font-medium text-ink">{layer}</dt>
                  <dd className="text-ink-secondary">{items}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <Card as="section" title="Team">
          <div className="flex flex-wrap items-start gap-4">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-hover text-ink-secondary">
              <Icon icon={GraduationCap} size={20} />
            </span>
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="text-ink">
                Built by <span className="font-medium">Avi Akhilesh Mishra (23BCP266)</span> and{" "}
                <span className="font-medium">Harshil Himanshubhai Khara (23BCP249)</span>.
              </p>
              <p className="text-ink-secondary">
                Under the guidance of Dr. Darshit Shah, Assistant Professor, Department of Computer Science &amp; Engineering,
                School of Technology, PDEU.
              </p>
              <a href="https://github.com/avimishra25/CareerCompass-AI" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-control pt-1 font-medium text-brand hover:underline">
                Source code on GitHub <Icon icon={ExternalLink} />
              </a>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
