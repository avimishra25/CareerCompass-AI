import React, { forwardRef } from "react";
import { ChevronRight, Menu, MessageSquare, Plus } from "lucide-react";
import { Button, Icon, cx } from "../ui";
import { pageMeta } from "./navigation";

// Slim bar: menu button (below 1024px), breadcrumb, "New analysis" and the Career Coach toggle.
const TopBar = forwardRef(function TopBar({ currentPage, onNavigate, onOpenMenu, menuOpen, coachOpen, onToggleCoach }, menuButtonRef) {
  const { trail, parent } = pageMeta(currentPage);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-4 sm:px-6">
      <Button ref={menuButtonRef} variant="ghost" size="sm" icon={Menu} aria-label="Open navigation" aria-expanded={menuOpen}
        onClick={onOpenMenu} className="-ml-2 lg:hidden" />
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {trail.map((crumb, index) => {
            const last = index === trail.length - 1;
            return (
              <li key={crumb} className={cx("flex min-w-0 items-center gap-1.5", !last && "hidden sm:flex")}>
                {parent && index === 0
                  ? <button type="button" onClick={() => onNavigate(parent)} className="rounded-control text-ink-muted hover:text-ink-secondary">{crumb}</button>
                  : <span className={cx("truncate", last ? "font-medium text-ink" : "text-ink-muted")} aria-current={last ? "page" : undefined}>{crumb}</span>}
                {!last && <Icon icon={ChevronRight} className="shrink-0 text-ink-muted" />}
              </li>
            );
          })}
        </ol>
      </nav>
      {currentPage !== "analyze" && (
        <Button variant="primary" size="sm" icon={Plus} onClick={() => onNavigate("analyze")} aria-label="New analysis">
          <span className="hidden sm:inline">New analysis</span>
        </Button>
      )}
      <Button variant={coachOpen ? "secondary" : "ghost"} size="sm" icon={MessageSquare} onClick={onToggleCoach}
        aria-expanded={coachOpen} aria-controls="career-coach" aria-label="Career coach"
        className={cx(coachOpen && "border-brand text-brand")}>
        <span className="hidden md:inline">Coach</span>
      </Button>
    </header>
  );
});

export default TopBar;
