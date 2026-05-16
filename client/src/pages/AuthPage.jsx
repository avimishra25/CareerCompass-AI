import React from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const BrandHeader = () => (
  <div className="text-center mb-8 fade-up">
    <div className="inline-flex items-center gap-2.5 mb-5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg"
        style={{ background: "linear-gradient(135deg,#3b6ef8,#6c63ff)", fontFamily: "Plus Jakarta Sans,sans-serif" }}>C</div>
      <span className="font-bold text-xl" style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans,sans-serif" }}>CareerCompass AI</span>
    </div>
    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans,sans-serif" }}>
      Welcome
    </h1>
    <p style={{ color: "var(--text-2)", fontFamily: "Plus Jakarta Sans,sans-serif", fontSize: "0.9rem" }}>
      Sign in to start discovering your career path
    </p>
  </div>
);

export default function AuthPage() {
  const handleGoogleLogin = () => {
    window.location.href = `${API}/api/auth/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="w-full max-w-md relative z-10">
        <BrandHeader />
        <div className="glass rounded-3xl p-8 fade-up-1 flex flex-col gap-4">

          {/* Google Sign-In */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              border: "1px solid var(--border-subtle)",
              background: "rgba(255,255,255,0.06)",
              color: "var(--text)",
              fontFamily: "Plus Jakarta Sans,sans-serif",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-xs" style={{ color: "var(--text-3)", fontFamily: "Plus Jakarta Sans,sans-serif" }}>
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}