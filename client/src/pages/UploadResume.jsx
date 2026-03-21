import React, { useState } from "react";
import axios from "axios";

function UploadResume() {
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    if (!file) return alert("Upload a resume first");

    const formData = new FormData();
    formData.append("resume", file);

    try {
      await axios.post("http://localhost:5000/upload", formData);
      alert("Upload successful 🚀");
    } catch (err) {
      alert("Upload failed ❌");
    }
  };

  return (
    <div className="bg-gray-900 p-8 rounded-2xl shadow-xl text-center w-[350px]">
      
      <h2 className="text-xl font-semibold mb-4">
        Upload Resume
      </h2>

      <input
        type="file"
        className="mb-4 text-sm"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <button
        onClick={handleUpload}
        className="w-full bg-blue-500 py-2 rounded-lg hover:bg-blue-600 transition duration-300"
      >
        Upload
      </button>

    </div>
  );
}

export default UploadResume;