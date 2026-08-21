const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const config = require("../config");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Random, unguessable name - the original filename is never
    // trusted for anything (path traversal, collisions, etc).
    var ext = path.extname(file.originalname || "").slice(0, 8);
    var safeExt = /^\.[a-zA-Z0-9]+$/.test(ext) ? ext : "";
    cb(null, crypto.randomBytes(16).toString("hex") + safeExt);
  }
});

function fileFilter(req, file, cb) {
  if (file.mimetype.indexOf("image/") !== 0) {
    return cb(new Error("PROOF_NOT_IMAGE"));
  }
  cb(null, true);
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: config.maxProofUploadBytes }
});

module.exports = { upload, UPLOAD_DIR };
