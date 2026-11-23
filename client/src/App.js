import React, { useState, useEffect } from "react";
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
import FullPageStatus from "./components/FullPageStatus";
import { Button } from "./components/ui";

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

  if (loading) return <FullPageStatus message="Loading CareerCompass AI…" />;

  // Google OAuth callback: reads the token from the URL, logs in, then goes to the dashboard.
  if (currentPage === "oauth-success") {
    return <OAuthSuccess onNavigate={navigate} />;
  }

  if (currentPage === "auth-error") {
    return (
      <FullPageStatus busy={false} message="Sign-in failed. Try again."
        action={<Button variant="primary" onClick={() => setCurrentPage("home")}>Back to sign in</Button>} />
    );
  }

  if (!user) return <Landing />;

  return (
    <AppDataProvider>
    <AppShell currentPage={currentPage} onNavigate={navigate} user={user} onLogout={logout}>
      {(currentPage === "home" || currentPage === "dashboard") &&
        <Dashboard onNavigate={navigate} />
      }

      {currentPage === "analyze" && <UploadResume onNavigate={navigate} presetFile={pageData.file} />}

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
