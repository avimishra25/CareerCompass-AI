import React from "react";

function Features() {
  return (
    <div className="mt-20 px-10 text-center">
      
      <h1 className="text-3xl font-bold mb-10">
        What We Offer
      </h1>

      <div className="grid md:grid-cols-3 gap-8">
        
        <div className="bg-gray-900 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Resume Analysis</h2>
          <p className="text-gray-400">
            Extract skills and insights from your resume using AI.
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Career Matching</h2>
          <p className="text-gray-400">
            Match your profile with ideal job roles.
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Skill Gap Analysis</h2>
          <p className="text-gray-400">
            Discover what skills you need to improve.
          </p>
        </div>

      </div>

    </div>
  );
}

export default Features;