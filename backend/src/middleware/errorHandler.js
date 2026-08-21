const multer = require("multer");

module.exports = function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "That image is too large - please keep it under 8MB." });
    }
    return res.status(400).json({ error: "There was a problem with the uploaded file." });
  }

  if (err && err.message === "PROOF_NOT_IMAGE") {
    return res.status(400).json({ error: "Please upload an image file (JPG or PNG)." });
  }

  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end. Please try again." });
};
