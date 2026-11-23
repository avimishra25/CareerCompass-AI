import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

// One list for both menus. Signed-in pages first; About is public.
export const NAV_LINKS = [
  { page: "dashboard",      label: "Dashboard",      auth: true },
  { page: "analyze",        label: "Analyze",        auth: true },
  { page: "history",        label: "History",        auth: true },
  { page: "jd-match",       label: "JD Match",       auth: true },
  { page: "roadmap",        label: "Roadmap",        auth: true },
  { page: "resume-builder", label: "Resume Builder", auth: true },
  { page: "interview",      label: "Interview",      auth: true },
  { page: "about",          label: "About",          auth: false },
];

export default function Navbar({ onNavigate, currentPage }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = NAV_LINKS.filter((item) => user || !item.auth);

  const link = (page, label) => (
    <button
      key={page}
      onClick={() => { onNavigate(page); setMenuOpen(false); }}
      aria-current={currentPage === page ? "page" : undefined}
      className="text-sm font-medium transition-colors whitespace-nowrap text-left"
      style={{
        color: currentPage === page ? "#3b6ef8" : "var(--text-2)",
        fontFamily: "Plus Jakarta Sans, sans-serif",
      }}>
      {label}
    </button>
  );

  return (
    <nav
      className="sticky top-0 z-50 px-6 py-3.5"
      style={{
        background: "rgba(240,242,247,0.8)",
        backdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(180,190,220,0.35)",
      }}>
      <div className="max-w-6xl mx-auto flex justify-between items-center gap-4">

        {/* Logo */}
        <button
          onClick={() => onNavigate(user ? "dashboard" : "home")}
          className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow"
            style={{ background: "linear-gradient(135deg,#3b6ef8,#6c63ff)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            C
          </div>
          <span
            className="font-bold text-base whitespace-nowrap"
            style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            CareerCompass AI
          </span>
        </button>

        {/* Desktop nav: from 1024px. Tighter gaps and an initial-only avatar until 1280px keep it on one line. */}
        <div className="hidden lg:flex items-center gap-3.5 xl:gap-6" data-testid="desktop-nav">
          {links.map((item) => link(item.page, item.label))}

          {user ? (
            <div className="flex items-center gap-2 xl:gap-3 shrink-0">

              {/* ── Avatar — clicks to Profile page ── */}
              <button
                onClick={() => onNavigate("profile")}
                aria-label="Profile"
                className="flex items-center gap-2 px-2 xl:px-3 py-1.5 rounded-xl transition"
                style={{
                  background: currentPage === "profile"
                    ? "rgba(59,110,248,0.14)"
                    : "rgba(59,110,248,0.07)",
                  border: currentPage === "profile"
                    ? "1px solid rgba(59,110,248,0.35)"
                    : "1px solid rgba(59,110,248,0.15)",
                }}>
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: "linear-gradient(135deg,#3b6ef8,#6c63ff)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden xl:inline-block max-w-[7rem] truncate align-middle text-sm font-medium" style={{ color: "var(--text-2)" }}>
                  {user.name.split(" ")[0]}
                </span>
              </button>

              <button
                onClick={logout}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition"
                style={{
                  color: "#e11d6a",
                  background: "rgba(244,63,126,0.07)",
                  border: "1px solid rgba(244,63,126,0.18)",
                }}>
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => document.getElementById("auth-section")?.scrollIntoView({ behavior: "smooth" })}
              className="btn-primary px-5 py-2 rounded-xl text-sm whitespace-nowrap">
              Get Started
            </button>
          )}
        </div>

        {/* Menu button below 1024px */}
        <button
          className="lg:hidden p-2 rounded-lg transition"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          style={{
            color: "var(--text-2)",
            background: menuOpen ? "rgba(59,110,248,0.08)" : "transparent",
          }}
          onClick={() => setMenuOpen(!menuOpen)}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            {menuOpen
              ? <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div id="mobile-nav" data-testid="mobile-nav" className="lg:hidden mt-3 mx-2 mb-2 glass rounded-2xl p-4 flex flex-col gap-3">
          {links.map((item) => link(item.page, item.label))}
          {user && link("profile", "Profile")}
          {user && (
            <button
              onClick={() => { logout(); setMenuOpen(false); }}
              className="text-sm font-medium text-left"
              style={{ color: "#e11d6a" }}>
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
