const db = require("../db");

/* Haversine great-circle distance, in kilometers. Mirrors
   dmHaversineKm in js/delivery-map.js. */
function haversineKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = ((lat2 - lat1) * Math.PI) / 180;
  var dLon = ((lon2 - lon1) * Math.PI) / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* Fee/time estimate from straight-line distance. Mirrors
   dmEstimateForDistance in js/delivery-map.js exactly, so a landmark
   prices the same whether the client shows it or the server charges
   it. */
function estimateForDistance(km) {
  var fee = Math.round((20 + km * 9) / 5) * 5;
  if (fee < 20) fee = 20;
  var lowMin = Math.round(12 + km * 5);
  var highMin = lowMin + 10;
  return { fee: fee, timeLabel: lowMin + "-" + highMin + " min", km: km };
}

/* Cafe location, used as the distance origin. Loaded lazily from the
   DB isn't necessary since it's fixed - kept here as a constant that
   matches landmarks-data.js (the seed source). */
const CAFE_LOCATION = require("./landmarks-data").CAFE_LOCATION;

async function getLandmarkById(id) {
  if (!id) return null;
  const result = await db.query(
    "SELECT id, name, lat, lng, approx FROM delivery_landmarks WHERE id = $1",
    [id]
  );
  if (!result.rows.length) return null;
  var row = result.rows[0];
  var km = haversineKm(CAFE_LOCATION.lat, CAFE_LOCATION.lng, row.lat, row.lng);
  var est = estimateForDistance(km);
  return {
    id: row.id,
    name: row.name,
    approx: row.approx,
    km: est.km,
    fee: est.fee,
    timeLabel: est.timeLabel
  };
}

async function listLandmarks() {
  const result = await db.query(
    "SELECT id, name, lat, lng, approx FROM delivery_landmarks ORDER BY name ASC"
  );
  return result.rows.map(function (row) {
    var km = haversineKm(CAFE_LOCATION.lat, CAFE_LOCATION.lng, row.lat, row.lng);
    var est = estimateForDistance(km);
    return {
      id: row.id,
      name: row.name,
      approx: row.approx,
      km: Number(est.km.toFixed(1)),
      fee: est.fee,
      timeLabel: est.timeLabel
    };
  });
}

module.exports = { haversineKm, estimateForDistance, getLandmarkById, listLandmarks };
