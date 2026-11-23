import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import FullPageStatus from "../components/FullPageStatus";
import { Button } from "../components/ui";

export default function OAuthSuccess({ onNavigate }) {
  const { loginWithToken } = useAuth();
  const [failure, setFailure] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      loginWithToken(token)
        .then(() => {
          window.history.replaceState({}, document.title, "/");
          onNavigate("dashboard");
        })
        .catch(() => setFailure("Sign-in failed. Try again."));
    } else {
      setFailure("Sign-in did not complete. Try again.");
    }
  }, []); // eslint-disable-line

  if (failure) {
    return (
      <FullPageStatus busy={false} message={failure}
        action={<Button variant="primary" onClick={() => { window.history.replaceState({}, document.title, "/"); onNavigate("home"); }}>Back to sign in</Button>} />
    );
  }
  return <FullPageStatus message="Signing you in…" />;
}
