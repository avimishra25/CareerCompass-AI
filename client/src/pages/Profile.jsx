import React from "react";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen px-4 py-12 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-6">

        {/* ── Profile Info Card ── */}
        <div className="glass rounded-3xl p-8">
          <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans,sans-serif" }}>
            My Profile
          </h2>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#3b6ef8,#6c63ff)" }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-lg" style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans,sans-serif" }}>
                {user?.name}
              </p>
              <p className="text-sm" style={{ color: "var(--text-2)", fontFamily: "Plus Jakarta Sans,sans-serif" }}>
                {user?.email}
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(59,110,248,0.05)", border: "1px solid rgba(59,110,248,0.1)" }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--text-3)" }}>Name</span>
              <span style={{ color: "var(--text)" }}>{user?.name}</span>
            </div>
            <div className="flex justify-between text-sm" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
              <span style={{ color: "var(--text-3)" }}>Email</span>
              <span style={{ color: "var(--text)" }}>{user?.email}</span>
            </div>
            <div className="flex justify-between text-sm" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
              <span style={{ color: "var(--text-3)" }}>Sign-in method</span>
              <span style={{ color: "var(--text)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                {/* Google icon */}
                <svg width="14" height="14" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Google
              </span>
            </div>
            <div className="flex justify-between text-sm" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
              <span style={{ color: "var(--text-3)" }}>Status</span>
              <span style={{ color: "#10b981", fontWeight: 600 }}>✓ Verified</span>
            </div>
          </div>
        </div>

        {/* ── Sign Out Card ── */}
        <div className="glass rounded-3xl p-6 text-center">
          <p className="text-sm mb-4" style={{ color: "var(--text-2)" }}>
            Want to sign out of your account?
          </p>
          <button onClick={logout}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(244,63,126,0.08)", border: "1px solid rgba(244,63,126,0.2)", color: "#e11d6a" }}>
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}