import React from "react";
import { CircleAlert, Compass, LoaderCircle } from "lucide-react";
import { Icon, SLOW_MESSAGE, useSlowNotice } from "./ui";

// Full-screen status for app start, the OAuth hand-off and sign-in errors.
// While busy, it explains a cold backend after 8 seconds (free hosting tiers sleep when idle).
export default function FullPageStatus({ message, busy = true, action }) {
  const slow = useSlowNotice(busy);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page px-4 text-center">
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-control bg-brand text-white">
        <Icon icon={Compass} size={20} />
      </span>
      <p role={busy ? "status" : "alert"} className="flex items-center gap-2 text-sm text-ink-secondary">
        <Icon icon={busy ? LoaderCircle : CircleAlert} className={busy ? "animate-spin text-brand" : "text-danger"} />
        {message}
      </p>
      {busy && slow && <p className="max-w-sm text-sm text-ink-muted">{SLOW_MESSAGE}</p>}
      {action}
    </div>
  );
}
