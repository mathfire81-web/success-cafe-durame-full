const crypto = require("crypto");
const config = require("../config");

/* Uploads to Supabase Storage over its plain REST API (no SDK
   dependency needed - just fetch, which Node 18+ has built in). The
   service role key is required here because it bypasses Storage's
   Row Level Security, which the public anon key deliberately can't -
   this is the one place in the app that's allowed to write, and it
   only ever runs behind requireAdmin. Never expose this key to the
   frontend. */
async function uploadMenuPhoto(buffer, mimetype, originalFilename) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("Photo upload isn't configured yet \u2014 set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  var ext = (originalFilename || "").split(".").pop();
  var safeExt = ext && /^[a-zA-Z0-9]+$/.test(ext) && ext.length <= 8 ? ext.toLowerCase() : "jpg";
  var path = "items/" + Date.now() + "-" + crypto.randomBytes(8).toString("hex") + "." + safeExt;

  var uploadUrl = config.supabaseUrl + "/storage/v1/object/" + config.menuPhotosBucket + "/" + path;

  var response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.supabaseServiceRoleKey,
      apikey: config.supabaseServiceRoleKey,
      "Content-Type": mimetype
    },
    body: buffer
  });

  if (!response.ok) {
    var text = await response.text().catch(function () { return ""; });
    throw new Error("Supabase Storage upload failed (" + response.status + "): " + text.slice(0, 200));
  }

  return config.supabaseUrl + "/storage/v1/object/public/" + config.menuPhotosBucket + "/" + path;
}

module.exports = { uploadMenuPhoto };
