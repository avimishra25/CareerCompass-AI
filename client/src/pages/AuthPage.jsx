import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

// Shared brand header component
const BrandHeader = ({ title, subtitle }) => (
  <div className="text-center mb-8 fade-up">
    <div className="inline-flex items-center gap-2.5 mb-5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg"
        style={{ background: "linear-gradient(135deg,#3b6ef8,#6c63ff)", fontFamily: "Plus Jakarta Sans,sans-serif" }}>C</div>
      <span className="font-bold text-xl" style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans,sans-serif" }}>CareerCompass AI</span>
    </div>
    <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text)", fontFamily: "Plus Jakarta Sans,sans-serif" }}>{title}</h1>
    <p style={{ color: "var(--text-2)", fontFamily: "Plus Jakarta Sans,sans-serif", fontSize: "0.9rem" }}>{subtitle}</p>
  </div>
);

const ErrorBox = ({ msg }) => msg ? (
  <div className="rounded-xl px-4 py-3 text-sm"
    style={{ background: "rgba(244,63,126,0.08)", border: "1px solid rgba(244,63,126,0.2)", color: "#e11d6a" }}>
    {msg}
  </div>
) : null;

const SuccessBox = ({ msg }) => msg ? (
  <div className="rounded-xl px-4 py-3 text-sm"
    style={{ background: "rgba(59,110,248,0.08)", border: "1px solid rgba(59,110,248,0.2)", color: "#3b6ef8" }}>
    {msg}
  </div>
) : null;

export default function AuthPage() {
  const { login, register, verifyOtp, resendOtp, forgotPassword, resetPassword } = useAuth();

  // Screen: "auth" | "otp" | "forgot" | "forgot-otp" | "reset"
  const [screen, setScreen] = useState("auth");

  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // OTP states
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resendMsg, setResendMsg] = useState("");

  // Reset password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Forgot password email
  const [forgotEmail, setForgotEmail] = useState("");

  const clearMessages = () => { setError(""); setSuccessMsg(""); setResendMsg(""); };
  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // ── Register / Login ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    clearMessages(); setLoading(true);
    try {
      if (isRegister) {
        const data = await register(form.name, form.email, form.password);
        setOtpEmail(data.email);
        setScreen("otp");
      } else {
        await login(form.email, form.password);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setOtpEmail(err.response.data.email);
        setScreen("otp");
      } else {
        setError(err.response?.data?.message || "Something went wrong.");
      }
    } finally { setLoading(false); }
  };

  // ── Verify OTP (registration) ──
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    clearMessages(); setLoading(true);
    try {
      await verifyOtp(otpEmail, otp);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP.");
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    clearMessages();
    try {
      await resendOtp(otpEmail);
      setResendMsg("A new OTP has been sent to your email.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not resend OTP.");
    }
  };

  // ── Forgot Password: Step 1 — Enter email ──
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    clearMessages(); setLoading(true);
    try {
      await forgotPassword(forgotEmail);
      setOtpEmail(forgotEmail);
      setScreen("forgot-otp");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally { setLoading(false); }
  };

  // ── Forgot Password: Step 2 — Verify OTP ──
  const handleForgotOtp = async (e) => {
    e.preventDefault();
    clearMessages(); setLoading(true);
    try {
      if (otp.length !== 6) return setError("Enter the 6-digit OTP.");
      setScreen("reset");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP.");
    } finally { setLoading(false); }
  };

  // ── Forgot Password: Step 3 — Set new password ──
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    clearMessages(); setLoading(true);
    try {
      if (newPassword !== confirmPassword)
        return setError("Passwords do not match.");
      if (newPassword.length < 6)
        return setError("Password must be at least 6 characters.");

      await resetPassword(otpEmail, otp, newPassword);
      setSuccessMsg("Password reset successful!");
      // Go back to login after short delay
      setTimeout(() => {
        setScreen("auth");
        setIsRegister(false);
        setOtp(""); setNewPassword(""); setConfirmPassword("");
        clearMessages();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally { setLoading(false); }
  };

  // ─────────────────────────────────────────
  // OTP Screen (registration verify)
  // ─────────────────────────────────────────
  if (screen === "otp") return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="w-full max-w-md relative z-10">
        <BrandHeader title="Check your email" subtitle={<>We sent a 6-digit code to <b>{otpEmail}</b></>} />
        <div className="glass rounded-3xl p-8 fade-up-1">
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Enter OTP</label>
              <input type="text" maxLength={6} value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                className="input-glass w-full rounded-xl px-4 py-3 text-sm tracking-widest text-center" required />
            </div>
            <ErrorBox msg={error} />
            <SuccessBox msg={resendMsg} />
            <button type="submit" disabled={loading || otp.length !== 6}
              className="btn-primary w-full py-3.5 rounded-xl text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Verifying…" : "Verify Email"}
            </button>
          </form>
          <div className="mt-6 pt-5 text-center" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              Didn't receive the code?
              <button onClick={handleResend} className="ml-2 font-semibold" style={{ color: "#3b6ef8" }}>Resend OTP</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────
  // Forgot Password: Step 1 — Enter email
  // ─────────────────────────────────────────
  if (screen === "forgot") return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="w-full max-w-md relative z-10">
        <BrandHeader title="Forgot password?" subtitle="Enter your email and we'll send you a reset code" />
        <div className="glass rounded-3xl p-8 fade-up-1">
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Email</label>
              <input type="email" required value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-glass w-full rounded-xl px-4 py-3 text-sm" />
            </div>
            <ErrorBox msg={error} />
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3.5 rounded-xl text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </form>
          <div className="mt-6 pt-5 text-center" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <button onClick={() => { setScreen("auth"); clearMessages(); }}
              className="text-sm font-semibold" style={{ color: "#3b6ef8" }}>
              ← Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────
  // Forgot Password: Step 2 — Enter OTP
  // ─────────────────────────────────────────
  if (screen === "forgot-otp") return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="w-full max-w-md relative z-10">
        <BrandHeader title="Enter reset code" subtitle={<>We sent a 6-digit code to <b>{otpEmail}</b></>} />
        <div className="glass rounded-3xl p-8 fade-up-1">
          <form onSubmit={handleForgotOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>OTP Code</label>
              <input type="text" maxLength={6} value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                className="input-glass w-full rounded-xl px-4 py-3 text-sm tracking-widest text-center" required />
            </div>
            <ErrorBox msg={error} />
            <button type="submit" disabled={loading || otp.length !== 6}
              className="btn-primary w-full py-3.5 rounded-xl text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Verifying…" : "Verify OTP"}
            </button>
          </form>
          <div className="mt-6 pt-5 text-center" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <button onClick={() => setScreen("forgot")} className="text-sm font-semibold" style={{ color: "#3b6ef8" }}>
              ← Change email
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────
  // Forgot Password: Step 3 — Set new password
  // ─────────────────────────────────────────
  if (screen === "reset") return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="w-full max-w-md relative z-10">
        <BrandHeader title="Set new password" subtitle="Choose a strong password for your account" />
        <div className="glass rounded-3xl p-8 fade-up-1">
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>New Password</label>
              <input type="password" required value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="input-glass w-full rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Confirm Password</label>
              <input type="password" required value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="input-glass w-full rounded-xl px-4 py-3 text-sm" />
            </div>
            <ErrorBox msg={error} />
            <SuccessBox msg={successMsg} />
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3.5 rounded-xl text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Resetting…" : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────
  // Main Login / Register Screen
  // ─────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="w-full max-w-md relative z-10">
        <BrandHeader
          title={isRegister ? "Create your account" : "Welcome back"}
          subtitle={isRegister ? "Start discovering your career path today" : "Sign in to continue your journey"}
        />
        <div className="glass rounded-3xl p-8 fade-up-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Full Name</label>
                <input name="name" type="text" required value={form.name} onChange={handleChange}
                  placeholder="Avi Mishra" className="input-glass w-full rounded-xl px-4 py-3 text-sm" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Email</label>
              <input name="email" type="email" required value={form.email} onChange={handleChange}
                placeholder="you@example.com" className="input-glass w-full rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Password</label>
              <input name="password" type="password" required value={form.password} onChange={handleChange}
                placeholder={isRegister ? "Min. 6 characters" : "••••••••"}
                className="input-glass w-full rounded-xl px-4 py-3 text-sm" />
            </div>

            {/* Forgot password link — only on login */}
            {!isRegister && (
              <div className="text-right">
                <button type="button"
                  onClick={() => { setScreen("forgot"); clearMessages(); setForgotEmail(form.email); }}
                  className="text-xs font-semibold" style={{ color: "#3b6ef8" }}>
                  Forgot password?
                </button>
              </div>
            )}

            <ErrorBox msg={error} />

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3.5 rounded-xl text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Please wait…" : isRegister ? "Create Account" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-5 text-center" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              {isRegister ? "Already have an account?" : "Don't have an account?"}
              <button onClick={() => { setIsRegister(!isRegister); setError(""); setForm({ name: "", email: "", password: "" }); }}
                className="ml-2 font-semibold" style={{ color: "#3b6ef8" }}>
                {isRegister ? "Sign in" : "Register"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 