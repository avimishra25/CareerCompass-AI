import React from "react";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();

  return (
    <div className="flex justify-between items-center px-10 py-4 bg-black text-white">
      <h1 className="text-xl font-bold">CareerCompass AI</h1>

      <div className="flex items-center space-x-6">
        <button className="hover:text-gray-300">Features</button>
        <button className="hover:text-gray-300">About</button>

        {user ? (
          <div className="flex items-center space-x-4">
            <span className="text-gray-300 text-sm">
              👋 {user.name}
            </span>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm transition"
            >
              Logout
            </button>
          </div>
        ) : (
          <button className="bg-blue-500 px-4 py-2 rounded-lg hover:bg-blue-600">
            Get Started
          </button>
        )}
      </div>
    </div>
  );
}

export default Navbar;
