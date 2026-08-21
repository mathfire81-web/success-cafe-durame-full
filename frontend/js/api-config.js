/*
  API_BASE_URL - the deployed backend's origin (Render), e.g.
  "https://success-cafe-backend.onrender.com". No trailing slash.

  Loaded before payment.js so it can prefix API calls with this value.
  Left empty, calls fall back to same-origin relative paths (useful if
  you ever run frontend + backend together again).
*/
window.API_BASE_URL = "https://YOUR-BACKEND.onrender.com";
