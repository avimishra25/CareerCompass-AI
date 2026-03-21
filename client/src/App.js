import React from "react";
import UploadResume from "./pages/UploadResume";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white">
      
      <div className="text-center pt-16">
        <h1 className="text-4xl font-bold">🚀 CareerCompass AI</h1>
        <p className="text-gray-400 mt-2">
          Analyze your resume & get career insights
        </p>
      </div>

      <div className="flex justify-center mt-12">
        <UploadResume />
      </div>

    </div>
  );
}

export default App;