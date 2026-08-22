/*
  API_BASE_URL - where the frontend sends API requests.

  In production the frontend is deployed separately on Vercel
  (https://success-cafe-durame.vercel.app) from the API on Render
  (https://success-cafe-durame-full.onrender.com) - two different
  origins, so this needs to be the full Render URL there.

  Locally, though, there's no Vercel involved - running `npm start`
  in backend/ serves this frontend AND the API from the same
  http://localhost:3000, so pointing at Render would just mean you're
  testing against production instead of your own machine. Auto-detect
  which case we're in by hostname instead of having to remember to
  flip this by hand.
*/
window.API_BASE_URL =
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? ""
    : "https://success-cafe-durame-full.onrender.com";
