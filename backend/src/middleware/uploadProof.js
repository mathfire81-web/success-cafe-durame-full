const multer = require("multer");
const config = require("./../config");

function fileFilter(req, file, cb) {
  if (file.mimetype.indexOf("image/") !== 0) {
    return cb(new Error("PROOF_NOT_IMAGE"));
  }
  cb(null, true);
}

// Memory storage, not disk: this file only ever needs to exist long
// enough to forward it to Supabase Storage in the route handler -
// writing it to Render's disk first would be pointless (that disk is
// wiped on every deploy, which is exactly why proof screenshots used
// to disappear - see lib/supabaseStorage.js).
const uploadProof = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: { fileSize: config.maxProofUploadBytes }
});

module.exports = { uploadProof };
