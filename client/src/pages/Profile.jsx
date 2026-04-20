import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, changePassword, logout } = useAuth();

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccessMsg("");

    if (form.newPassword !== form.confirmPassword)
      return setError("New passwords do not match.");

    if (form.newPassword.length < 6)
      return setError("New password must be at least 6 characters.");

    setLoading(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      setSuccessMsg("Password changed successfully!");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-12 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-6">

        {/* ── Profile Info Card ── */}
        <div className="glass rounded-3xl p-8">
          <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans,sans-serif" }}>
            My Profile
          </h2>

          <div className="flex items-center gap-4 mb-6">
            {/* Avatar circle */}
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
              <span style={{ color: "var(--text-3)" }}>Status</span>
              <span style={{ color: "#10b981", fontWeight: 600 }}>✓ Verified</span>
            </div>
          </div>
        </div>

        {/* ── Change Password Card ── */}
        <div className="glass rounded-3xl p-8">
          <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans,sans-serif" }}>
            Change Password
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                Current Password
              </label>
              <input
                name="currentPassword" type="password" required
                value={form.currentPassword} onChange={handleChange}
                placeholder="Enter current password"
                className="input-glass w-full rounded-xl px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                New Password
              </label>
              <input
                name="newPassword" type="password" required
                value={form.newPassword} onChange={handleChange}
                placeholder="Min. 6 characters"
                className="input-glass w-full rounded-xl px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                Confirm New Password
              </label>
              <input
                name="confirmPassword" type="password" required
                value={form.confirmPassword} onChange={handleChange}
                placeholder="Repeat new password"
                className="input-glass w-full rounded-xl px-4 py-3 text-sm"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(244,63,126,0.08)", border: "1px solid rgba(244,63,126,0.2)", color: "#e11d6a" }}>
                {error}
              </div>
            )}

            {/* Success */}
            {successMsg && (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
                {successMsg}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3.5 rounded-xl text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>
        </div>

        {/* ── Logout Button ── */}
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