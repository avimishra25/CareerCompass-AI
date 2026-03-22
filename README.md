🚀 CareerCompass AI
An AI-powered career guidance platform that analyzes resumes and provides intelligent career recommendations based on skills and job-role matching.

📌 Overview
CareerCompass AI is a full-stack web application that helps users understand their career alignment by analyzing their resumes using Natural Language Processing (NLP). It extracts skills, evaluates compatibility with different job roles, and suggests the most suitable career path.

✨ Features
📄 Resume upload (PDF support)
🤖 NLP-based skill extraction using Python (spaCy)
🎯 Job-role matching algorithm
📊 Match percentage calculation for multiple roles
⚠️ Missing skill identification
⭐ Best career role recommendation
📈 Interactive dashboard with progress bars
🔗 Full-stack integration (Frontend ↔ Backend ↔ AI service)
🛠️ Tech Stack
Frontend
React.js
Tailwind CSS
Axios
Backend
Node.js
Express.js
Multer (file upload)
AI / NLP
Python
Flask
spaCy
pdfminer
🧠 How It Works
User uploads a resume (PDF)
Backend sends file to Python NLP service
NLP extracts relevant skills
Backend compares skills with predefined job roles
Match score and missing skills are calculated
Best career role is recommended
Results are displayed in an interactive dashboard
📂 Project Structure
CareerCompass-AI/

├── client/ # React frontend

├── server/ # Node.js backend

├── ml-service/ # Python NLP service

⚙️ Setup Instructions
1. Clone Repository
git clone https://github.com/aviam25/CareerCompass-AI.git

cd CareerCompass-AI

2. Frontend Setup
cd client

npm install

npm start

3. Backend Setup
cd server

npm install

node server.js

4. NLP Service Setup
cd ml-service

python -m venv venv

venv\Scripts\activate # Windows

pip install flask spacy pdfminer.six

python -m spacy download en_core_web_sm

python app.py

🚀 Current Status
✅ Core functionality completed:

Resume analysis
Skill extraction
Job matching
Career recommendation
🔄 Upcoming features:

Authentication (Login/Signup)
MongoDB integration
User history tracking
Downloadable reports
Advanced AI improvements
Enhanced UI/UX
📈 Future Scope
Resume scoring system (ATS-based)
Career roadmap suggestions
Graphs & analytics dashboard
Real job API integration
AI chatbot for career guidance
🤝 Contributing
Contributions are welcome! Feel free to fork the repo and submit a pull request.

📬 Contact
If you have any feedback or suggestions, feel free to connect.

⭐ If you like this project, consider giving it a star!