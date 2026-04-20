import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setLoading(false); return; }

    axios
      .get(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setUser(data.user))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API}/api/auth/login`, { email, password });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await axios.post(`${API}/api/auth/register`, { name, email, password });
    return data;
  };

  const verifyOtp = async (email, otp) => {
    const { data } = await axios.post(`${API}/api/auth/verify-otp`, { email, otp });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data;
  };

  const resendOtp = async (email) => {
    const { data } = await axios.post(`${API}/api/auth/resend-otp`, { email });
    return data;
  };

  // ── NEW: Change password (logged in) ──
  const changePassword = async (currentPassword, newPassword) => {
    const token = localStorage.getItem("token");
    const { data } = await axios.post(
      `${API}/api/auth/change-password`,
      { currentPassword, newPassword },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data;
  };

  // ── NEW: Forgot password — sends OTP ──
  const forgotPassword = async (email) => {
    const { data } = await axios.post(`${API}/api/auth/forgot-password`, { email });
    return data;
  };

  // ── NEW: Reset password — verifies OTP + sets new password ──
  const resetPassword = async (email, otp, newPassword) => {
    const { data } = await axios.post(`${API}/api/auth/reset-password`, { email, otp, newPassword });
    return data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, login, register, verifyOtp, resendOtp,
      changePassword, forgotPassword, resetPassword,
      logout, loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);