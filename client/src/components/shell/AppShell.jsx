import React, { useRef, useState } from "react";
import CareerAgent from "../CareerAgent";
import { coachContextFrom, useAppData } from "../../context/AppDataContext";
import { cx } from "../ui";
import { MobileDrawer, SidebarContent } from "./Sidebar";
import TopBar from "./TopBar";

const COLLAPSE_KEY = "cc.sidebarCollapsed";
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; } };

// Signed-in layout: 240px sidebar (64px when collapsed; a drawer below 1024px), top bar, page, coach panel.
export default function AppShell({ currentPage, onNavigate, user, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const { history, coachAnalysis } = useAppData();
  const coach = coachContextFrom(coachAnalysis || history?.[0]) || {};

  const toggleCollapsed = () => setCollapsed((value) => {
    try { localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1"); } catch { /* preference only */ }
    return !value;
  });
  const navProps = { currentPage, onNavigate, user, onLogout };

  return (
    <div className="min-h-screen bg-page">
      <a href="#main" className="sr-only rounded-control bg-surface px-3 py-2 text-sm font-medium text-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60]">
        Skip to content
      </a>
      <aside className={cx("fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-surface lg:block", collapsed ? "w-16" : "w-60")}>
        <SidebarContent {...navProps} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>
      <MobileDrawer {...navProps} open={drawerOpen} onClose={() => setDrawerOpen(false)} returnFocusRef={menuButtonRef} />

      <div className={cx("flex min-h-screen min-w-0 flex-col", collapsed ? "lg:pl-16" : "lg:pl-60", coachOpen && "xl:pr-[380px]")}>
        <TopBar ref={menuButtonRef} currentPage={currentPage} onNavigate={onNavigate}
          onOpenMenu={() => setDrawerOpen(true)} menuOpen={drawerOpen}
          coachOpen={coachOpen} onToggleCoach={() => setCoachOpen((value) => !value)} />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <CareerAgent open={coachOpen} onClose={() => setCoachOpen(false)} {...coach} />
    </div>
  );
}
