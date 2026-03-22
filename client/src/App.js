import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import UploadResume from "./pages/UploadResume";
import Stats from "./components/Stats";
import Features from "./components/Features";
import AuthPage from "./pages/AuthPage";

function AppContent() {
  const { user, loading } = useAuth();

  // While checking token on mount, show a simple spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  // Not logged in → show auth page
  if (!user) {
    return <AuthPage />;
  }

  // Logged in → show main app
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white">
      <Navbar />
      <Hero />

      <div className="flex justify-center mt-16">
        <UploadResume />
      </div>

      <Stats />
      <Features />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;