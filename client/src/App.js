import React from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import UploadResume from "./pages/UploadResume";
import Stats from "./components/Stats";        // ✅ import
import Features from "./components/Features";  // ✅ import

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white">
      
      <Navbar />
      <Hero />

      {/* Upload Section */}
      <div className="flex justify-center mt-16">
        <UploadResume />
      </div>

      {/* ✅ ADD HERE */}
      <Stats />

      {/* ✅ ADD HERE */}
      <Features />

    </div>
  );
}

export default App;