import React from "react";

function Stats() {
  return (
    <div className="bg-gray-800 mt-20 py-10">
      
      <div className="grid grid-cols-2 md:grid-cols-4 text-center gap-6">
        
        <div>
          <h1 className="text-3xl font-bold text-blue-400">3M+</h1>
          <p className="text-gray-400">Users Analyzed</p>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-blue-400">50K+</h1>
          <p className="text-gray-400">Resumes Processed</p>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-blue-400">95%</h1>
          <p className="text-gray-400">Accuracy</p>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-blue-400">100+</h1>
          <p className="text-gray-400">Career Paths</p>
        </div>

      </div>

    </div>
  );
}

export default Stats;