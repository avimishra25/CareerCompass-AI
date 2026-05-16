import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function OAuthSuccess({ onNavigate }) {
  const { loginWithToken } = useAuth();
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("token");

    if (token) {
      loginWithToken(token)
        .then(() => {
          window.history.replaceState({}, document.title, "/");
          onNavigate("dashboard");
        })
        .catch(() => setStatus("Sign-in failed. Please try again."));
    } else {
      setStatus("No token found. Please try again.");
    }
  }, []); // eslint-disable-line

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        border: "3px solid rgba(59,110,248,0.2)",
        borderTopColor: "#3b6ef8",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: "var(--text-2)", fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: "0.9rem" }}>
        {status}
      </p>
    </div>
  );
}