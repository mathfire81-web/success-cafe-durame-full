/*
  API_BASE_URL - where the frontend sends API requests.

  The backend (backend/src/server.js) serves this frontend AND the API
  from the exact same Express app/origin - locally at
  http://localhost:3000, or on Render at your deployed URL. So this
  should always just be "" (same origin as the page), never a
  hardcoded URL - hardcoding it here previously meant that testing at
  localhost was silently sending every request to production instead,
  which is confusing to debug and pointless to test against.
*/
window.API_BASE_URL = "";
