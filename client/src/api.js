// This checks if the live URL exists; otherwise, it uses your local machine
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default API_BASE_URL;