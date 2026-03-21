import React from "react";

function Navbar() {
  return (
    <div className="flex justify-between items-center px-10 py-4 bg-black text-white">
      
      <h1 className="text-xl font-bold">CareerCompass AI</h1>

      <div className="space-x-6">
        <button className="hover:text-gray-300">Features</button>
        <button className="hover:text-gray-300">About</button>
        <button className="bg-blue-500 px-4 py-2 rounded-lg hover:bg-blue-600">
          Get Started
        </button>
      </div>

    </div>
  );
}

export default Navbar;