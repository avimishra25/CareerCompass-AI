import React from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Badge, Button, Card, PageHeader } from "../components/ui";

export default function Profile() {
  const { user, logout } = useAuth();
  const rows = [
    ["Name", user?.name],
    ["Email", user?.email],
    ["Sign-in method", "Google"],
  ];
  return (
    <>
      <PageHeader title="Profile" description="Your account details. Your analyses, roadmaps, drafts and sessions are stored under this account only." />
      <div className="max-w-2xl space-y-6">
        <Card as="section" title="Account">
          <div className="mb-4 flex items-center gap-3">
            <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-lg font-semibold text-brand">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-sm text-ink-muted">{user?.email}</p>
            </div>
          </div>
          <dl className="divide-y divide-line border-t border-line text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2.5">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="min-w-0 truncate text-ink">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-muted">Status</dt>
              <dd><Badge tone="success">Verified</Badge></dd>
            </div>
          </dl>
        </Card>
        <Card as="section" title="Log out" description="You can sign in again any time with the same Google account."
          actions={<Button variant="danger" icon={LogOut} onClick={logout}>Log out</Button>} />
      </div>
    </>
  );
}
