import React, { useEffect, useRef, useState } from "react";
import { Compass, LogOut, PanelLeftClose, PanelLeftOpen, User, X } from "lucide-react";
import { Button, Icon, Tooltip, cx } from "../ui";
import { NAV_BOTTOM, NAV_GROUPS, activeNavPage } from "./navigation";

// Up/Down/Home/End move focus between sidebar links (Tab still works as usual).
function moveFocus(event, container) {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key) || !container) return;
  const items = [...container.querySelectorAll("[data-nav-item]")];
  const index = items.indexOf(document.activeElement);
  if (index === -1) return;
  event.preventDefault();
  const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[event.key];
  items[(next + items.length) % items.length].focus();
}

function NavItem({ item, active, collapsed, onNavigate }) {
  const button = (
    <button
      type="button" data-nav-item onClick={() => onNavigate(item.page)}
      aria-current={active ? "page" : undefined} aria-label={collapsed ? item.label : undefined}
      className={cx(
        "flex h-9 w-full items-center gap-3 rounded-control text-sm font-medium transition-ui",
        collapsed ? "justify-center px-0" : "px-3",
        active ? "bg-brand-tint text-brand" : "text-ink-secondary hover:bg-hover hover:text-ink",
      )}
    >
      <Icon icon={item.icon} size={20} className="shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
  return <li><Tooltip content={item.label} side="right" disabled={!collapsed} className="w-full">{button}</Tooltip></li>;
}

function UserMenu({ user, collapsed, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => { if (open) menuRef.current?.querySelector("[role=menuitem]")?.focus(); }, [open]);
  const close = (refocus = true) => { setOpen(false); if (refocus) triggerRef.current?.focus(); };
  const onMenuKey = (event) => {
    const items = [...menuRef.current.querySelectorAll("[role=menuitem]")];
    const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    }
    if (event.key === "Tab") close(false);
  };
  const choose = (action) => { setOpen(false); action(); };
  const initial = user?.name?.charAt(0).toUpperCase() || "?";
  return (
    <div className="relative">
      <button
        ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${user?.name || "user"}`}
        onClick={() => setOpen((value) => !value)}
        className={cx("flex w-full items-center gap-3 rounded-control p-2 text-left transition-ui hover:bg-hover", collapsed && "justify-center")}
      >
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand">{initial}</span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{user?.name}</span>
            <span className="block truncate text-xs text-ink-muted">{user?.email}</span>
          </span>
        )}
      </button>
      {open && (
        <div ref={menuRef} role="menu" aria-label="Account" onKeyDown={onMenuKey}
          className={cx("absolute bottom-full z-50 mb-2 w-52 rounded-card border border-line bg-surface p-1 shadow-overlay", collapsed ? "left-0" : "left-0 right-0 w-auto")}>
          <button type="button" role="menuitem" onClick={() => choose(() => onNavigate("profile"))}
            className="flex h-9 w-full items-center gap-2 rounded-control px-3 text-sm text-ink-secondary hover:bg-hover">
            <Icon icon={User} /> Profile
          </button>
          <button type="button" role="menuitem" onClick={() => choose(onLogout)}
            className="flex h-9 w-full items-center gap-2 rounded-control px-3 text-sm text-danger hover:bg-danger-tint">
            <Icon icon={LogOut} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

// Navigation content shared by the desktop sidebar and the mobile drawer.
export function SidebarContent({ currentPage, onNavigate, user, onLogout, collapsed = false, onToggleCollapsed, onClose, navRef }) {
  const active = activeNavPage(currentPage);
  return (
    <div className="flex h-full flex-col">
      <div className={cx("flex h-14 shrink-0 items-center border-b border-line", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        <button type="button" onClick={() => onNavigate("dashboard")} className="flex min-w-0 items-center gap-2.5 rounded-control"
          aria-label={collapsed ? "CareerCompass AI, go to dashboard" : undefined}>
          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-brand text-white">
            <Icon icon={Compass} />
          </span>
          {!collapsed && <span className="truncate text-sm font-semibold text-ink">CareerCompass AI</span>}
        </button>
        {onClose && <Button variant="ghost" size="sm" icon={X} aria-label="Close navigation" onClick={onClose} />}
      </div>

      <nav ref={navRef} aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4" onKeyDown={(event) => moveFocus(event, event.currentTarget)}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            {collapsed
              ? <div aria-hidden="true" className="mx-2 mb-2 border-t border-line" />
              : <h2 id={`nav-${group.label}`} className="mb-1 px-3 text-xs font-medium text-ink-muted">{group.label}</h2>}
            <ul aria-labelledby={collapsed ? undefined : `nav-${group.label}`} aria-label={collapsed ? group.label : undefined} className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.page} item={item} active={active === item.page} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        ))}
        <ul aria-label="More" className="space-y-0.5 border-t border-line pt-4">
          {NAV_BOTTOM.map((item) => (
            <NavItem key={item.page} item={item} active={active === item.page} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>

      <div className="shrink-0 space-y-1 border-t border-line p-3">
        {onToggleCollapsed && (
          <Tooltip content="Expand sidebar" side="right" disabled={!collapsed} className="w-full">
            <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cx("flex h-9 w-full items-center gap-3 rounded-control text-sm text-ink-muted transition-ui hover:bg-hover hover:text-ink-secondary",
                collapsed ? "justify-center" : "px-3")}>
              <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} size={20} />
              {!collapsed && "Collapse"}
            </button>
          </Tooltip>
        )}
        <UserMenu user={user} collapsed={collapsed} onNavigate={onNavigate} onLogout={onLogout} />
      </div>
    </div>
  );
}

// Below 1024px: a modal slide-in drawer. Esc or a choice closes it and focus returns to the menu button.
export function MobileDrawer({ open, onClose, returnFocusRef, ...props }) {
  const panelRef = useRef(null);
  const navRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const returnTo = returnFocusRef?.current;
    navRef.current?.querySelector("[data-nav-item]")?.focus();
    return () => returnTo?.focus();
  }, [open, returnFocusRef]);
  if (!open) return null;
  const onKeyDown = (event) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    // Keep focus inside the open drawer.
    const focusable = [...panelRef.current.querySelectorAll("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")];
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return (
    <div className="fixed inset-0 z-50 lg:hidden" onKeyDown={onKeyDown}>
      <button type="button" aria-label="Close navigation" tabIndex={-1} onClick={onClose} className="absolute inset-0 h-full w-full bg-ink/40" />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Navigation"
        className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-surface shadow-overlay">
        <SidebarContent {...props} navRef={navRef} onClose={onClose}
          onNavigate={(page) => { onClose(); props.onNavigate(page); }}
          onLogout={() => { onClose(); props.onLogout(); }} />
      </div>
    </div>
  );
}
