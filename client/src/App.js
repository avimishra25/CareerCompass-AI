import React, { useState, useRef, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar       from "./components/Navbar";
import Hero         from "./components/Hero";
import UploadResume from "./pages/UploadResume";
import Stats        from "./components/Stats";
import Features     from "./components/Features";
import History      from "./pages/History";
import Compare      from "./pages/Compare";
import AuthPage     from "./pages/AuthPage";
import About        from "./pages/About";
import Dashboard    from "./pages/Dashboard";
import Profile      from "./pages/Profile";
import OAuthSuccess from "./pages/OAuthSuccess";

function AppInner() {
  const { user, loading } = useAuth();

  // Read URL params synchronously before first render so we never flash the
  // login page during the OAuth callback (token arrives as ?token=...)
  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("token"))      return "oauth-success";
    if (params.get("auth_error")) return "auth-error";
    return "home";
  });

  const [compareData, setCompareData] = useState({ analysisA: null, analysisB: null });
  const uploadRef = useRef(null);

  const navigate = (page, data = {}) => {
    if (page === "compare" && data.analysisA && data.analysisB) {
      setCompareData({ analysisA: data.analysisA, analysisB: data.analysisB });
    }
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

  if (!user) {
    return (
      <div className="min-h-screen" style={{ position: "relative" }}>
        <nav className="sticky top-0 z-50 px-6 py-3.5"
          style={{
            background: "rgba(240,242,247,0.8)",
            backdropFilter: "blur(20px) saturate(180%)",
            borderBottom: "1px solid rgba(180,190,220,0.35)",
          }}>
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow"
                style={{ background: "linear-gradient(135deg,#3b6ef8,#6c63ff)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                C
              </div>
              <span className="font-bold text-base"
                style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                CareerCompass AI
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => document.getElementById("auth-section")?.scrollIntoView({ behavior: "smooth" })}
                className="btn-primary px-5 py-2 rounded-xl text-sm">
                Sign In with Google
              </button>
            </div>
          </div>
        </nav>

        <Hero
          onAnalyze={() => document.getElementById("auth-section")?.scrollIntoView({ behavior: "smooth" })}
          onHowItWorks={() => document.getElementById("landing-features")?.scrollIntoView({ behavior: "smooth" })}
        />

        <div id="auth-section">
          <AuthPage />
        </div>

        <div id="landing-features">
          <Stats />
          <Features />
        </div>

        <footer className="text-center py-10" style={{ borderTop: "1px solid rgba(180,190,220,0.3)" }}>
          <p className="text-xs" style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            © 2026 CareerCompass AI · Built by Avi Mishra
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ position: "relative" }}>
      <Navbar onNavigate={navigate} currentPage={currentPage} />

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
            <UploadResume />
          </div>
        </div>
      }

      {currentPage === "history" && <History onNavigate={navigate} />}
      {currentPage === "compare" &&
        <Compare
          analysisA={compareData.analysisA}
          analysisB={compareData.analysisB}
          onNavigate={navigate}
        />
      }
      {currentPage === "about"   && <About />}
      {currentPage === "profile" && <Profile />}
    </div>
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}