const express = require("express");
const delivery = require("../lib/delivery");

const router = express.Router();

router.get("/", async function (req, res, next) {
  try {
    const landmarks = await delivery.listLandmarks();
    res.json({ landmarks: landmarks });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
