import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

function AuthPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await register(form.name, form.email, form.password);
      } else {
        await login(form.email, form.password);
      }
      // AuthContext updates user state — App will re-render automatically
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">CareerCompass AI</h1>
          <p className="text-gray-400 mt-2 text-sm">
            {isRegister
              ? "Create your account to get started"
              : "Sign in to your account"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold mb-6">
            {isRegister ? "Register" : "Login"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field — register only */}
            {isRegister && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Full Name
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Avi Mishra"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Email Address
              </label>
              <input
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder={isRegister ? "Min. 6 characters" : "••••••••"}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-900/40 border border-red-600 text-red-300 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-semibold transition duration-200 mt-2"
            >
              {loading
                ? isRegister
                  ? "Creating account..."
                  : "Signing in..."
                : isRegister
                ? "Create Account"
                : "Sign In"}
            </button>
          </form>

          {/* Toggle register / login */}
          <p className="text-center text-gray-400 text-sm mt-6">
            {isRegister ? "Already have an account?" : "Don't have an account?"}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
                setForm({ name: "", email: "", password: "" });
              }}
              className="text-blue-400 hover:text-blue-300 ml-1 underline underline-offset-2"
            >
              {isRegister ? "Sign in" : "Register"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
