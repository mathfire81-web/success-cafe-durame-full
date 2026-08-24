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

/* Payment proof screenshots use the same disk-wipe fix as menu photos,
   but the bucket must stay PRIVATE - these are customer payment
   screenshots, not something that should be reachable by anyone who
   guesses/finds the URL. So this returns the storage PATH (saved in
   orders.payment_proof_path), never a public URL, and bytes are only
   ever fetched back server-side via downloadPaymentProof(), from
   inside the authenticated GET /api/admin/orders/:id/proof route. */
async function uploadPaymentProof(buffer, mimetype, originalFilename) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("Payment proof storage isn't configured yet \u2014 set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  var ext = (originalFilename || "").split(".").pop();
  var safeExt = ext && /^[a-zA-Z0-9]+$/.test(ext) && ext.length <= 8 ? ext.toLowerCase() : "jpg";
  var objectPath = "proofs/" + Date.now() + "-" + crypto.randomBytes(8).toString("hex") + "." + safeExt;

  var uploadUrl = config.supabaseUrl + "/storage/v1/object/" + config.paymentProofBucket + "/" + objectPath;

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

  return objectPath;
}

// Fetches the raw bytes for a stored proof object. Uses the service
// role key (same as the upload), since the bucket is private and has
// no public read access.
async function downloadPaymentProof(objectPath) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("Payment proof storage isn't configured yet \u2014 set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  var downloadUrl = config.supabaseUrl + "/storage/v1/object/" + config.paymentProofBucket + "/" + objectPath;

  var response = await fetch(downloadUrl, {
    headers: {
      Authorization: "Bearer " + config.supabaseServiceRoleKey,
      apikey: config.supabaseServiceRoleKey
    }
  });

  if (!response.ok) return null;

  var arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") || "application/octet-stream"
  };
}

module.exports = { uploadMenuPhoto, uploadPaymentProof, downloadPaymentProof };
