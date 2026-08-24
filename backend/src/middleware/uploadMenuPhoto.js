const multer = require("multer");
const config = require("../config");

function fileFilter(req, file, cb) {
  if (file.mimetype.indexOf("image/") !== 0) {
    return cb(new Error("MENU_PHOTO_NOT_IMAGE"));
  }
  cb(null, true);
}

// Memory storage, not disk: this file only ever needs to exist long
// enough to forward it to Supabase Storage in the route handler -
// writing it to Render's disk first would be pointless (and that
// disk is wiped on every deploy anyway, see lib/supabaseStorage.js).
const uploadMenuPhoto = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: { fileSize: config.maxMenuPhotoBytes }
});

module.exports = { uploadMenuPhoto };
