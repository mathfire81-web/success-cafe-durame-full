/*
  API_BASE_URL - where the admin dashboard sends API requests.

  In production the admin dashboard is deployed separately on Vercel
  (https://success-cafe-admin.vercel.app) from the API on Render
  (https://success-cafe-durame-full.onrender.com) - two different
  origins, so this needs to be the full Render URL there.

  Locally there's no Vercel involved - `npm start` in backend/ serves
  this admin dashboard AND the API from the same
  http://localhost:3000, so auto-detect by hostname instead of having
  to remember to flip this by hand.
*/
window.API_BASE_URL =
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? ""
    : "https://success-cafe-durame-full.onrender.com";
