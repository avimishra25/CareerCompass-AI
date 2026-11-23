import React, { useState, useRef, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppShell     from "./components/shell/AppShell";
import { AppDataProvider } from "./context/AppDataContext";
import UploadResume from "./pages/UploadResume";
import History      from "./pages/History";
import Compare      from "./pages/Compare";
import About        from "./pages/About";
import Landing      from "./pages/Landing";
import Dashboard    from "./pages/Dashboard";
import JDMatch      from "./pages/JDMatch";
import Roadmap      from "./pages/Roadmap";
import ResumeBuilder from "./pages/ResumeBuilder";
import InterviewPrep from "./pages/InterviewPrep";
import Profile      from "./pages/Profile";
import OAuthSuccess from "./pages/OAuthSuccess";

function AppInner() {
  const { user, loading, logout } = useAuth();

  // Read URL params synchronously before first render so we never flash the
  // login page during the OAuth callback (token arrives as ?token=...)
  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("token"))      return "oauth-success";
    if (params.get("auth_error")) return "auth-error";
    return "home";
  });

  const [compareData, setCompareData] = useState({ analysisA: null, analysisB: null });
  // One-shot hand-off for cross-links (e.g. { analysisId, targetRole } for Roadmap). Every
  // navigation replaces it, so a later plain visit never reuses stale pre-selections.
  const [pageData, setPageData] = useState({});
  const uploadRef = useRef(null);

  const navigate = (page, data = {}) => {
    if (page === "compare" && data.analysisA && data.analysisB) {
      setCompareData({ analysisA: data.analysisA, analysisB: data.analysisB });
    }
    setPageData(data);
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Auto-navigate to dashboard when a returning user's token is restored from
  // localStorage. Does NOT fire during OAuth flow (currentPage = "oauth-success").
  useEffect(() => {
    if (user && currentPage === "home") {
      window.scrollTo({ top: 0, behavior: "instant" });
      setCurrentPage("dashboard");
    }
  }, [user]); // eslint-disable-line

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "3px solid rgba(59,110,248,0.2)",
          borderTopColor: "#3b6ef8",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Google OAuth callback — reads token from URL, logs in, redirects to dashboard
  if (currentPage === "oauth-success") {
    return <OAuthSuccess onNavigate={navigate} />;
  }

  // Auth error fallback
  if (currentPage === "auth-error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          Sign-in failed. Please try again.
        </p>
        <button onClick={() => setCurrentPage("home")} className="btn-primary px-6 py-2 rounded-xl text-sm">
          Go back
        </button>
      </div>
    );
  }

  if (!user) return <Landing />;

  return (
    <AppDataProvider>
    <AppShell currentPage={currentPage} onNavigate={navigate} user={user} onLogout={logout}>
      {(currentPage === "home" || currentPage === "dashboard") &&
        <Dashboard onNavigate={navigate} />
      }

      {currentPage === "analyze" &&
        <div>
          <div className="px-8 pt-10 pb-2 max-w-5xl mx-auto">
            <h1 className="text-2xl font-extrabold" style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Resume Analysis
            </h1>
            <p className="text-sm mt-1 mb-2" style={{ color: "var(--text-2)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Upload your PDF resume and get your career match report instantly.
            </p>
          </div>
          <div ref={uploadRef}>
            <UploadResume onNavigate={navigate} presetFile={pageData.file} />
          </div>
        </div>
      }

      {currentPage === "history" && <History onNavigate={navigate} />}
      {currentPage === "jd-match" && <JDMatch onNavigate={navigate} />}
      {currentPage === "roadmap" && <Roadmap onNavigate={navigate} preset={pageData} />}
      {currentPage === "resume-builder" && <ResumeBuilder onNavigate={navigate} />}
      {currentPage === "interview" && <InterviewPrep onNavigate={navigate} preset={pageData} />}
      {currentPage === "compare" &&
        <Compare
          analysisA={compareData.analysisA}
          analysisB={compareData.analysisB}
          onNavigate={navigate}
        />
      }
      {currentPage === "about"   && <About />}
      {currentPage === "profile" && <Profile />}
    </AppShell>
    </AppDataProvider>
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}
