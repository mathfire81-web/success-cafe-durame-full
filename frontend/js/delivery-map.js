/*
  DELIVERY MODAL MAP
  A real, embedded Google Map inside the floating delivery panel,
  centered on Success Cafe (satellite view). Tapping a landmark (in the
  chip row under the map) switches the embed to satellite driving
  directions - the actual road from Success Cafe to that spot - and our
  own info panel (opened via the small icon, bottom-right of the map)
  shows the straight-line distance, an estimated time, and an estimated
  fee, computed locally. Uses Google's key-less Maps embed (the same
  "output=embed" trick most restaurant sites use) so no API key/config
  is required. The default (no landmark picked) view is a plain marker
  on the cafe - lighter and faster than directions mode - and we only
  switch to the heavier directions embed once a landmark is actually
  selected, so the route line only costs load time when it's wanted.
*/

/* Success Cafe, Durame town. Fixed - there's no admin control for
   this (it's the one physical constant, not a manageable zone), so
   it stays a hardcoded literal, same as before. */
var CAFE_LOCATION = { lat: 7.2449066412107825, lng: 37.90079484003493 };

/* LANDMARKS used to be a hardcoded array here. It's now loaded live
   from GET /api/delivery-landmarks, which reads the admin-managed
   delivery_landmarks table (see admin dashboard's "Delivery Zones"
   panel / backend/src/routes/adminDeliveryZones.js) - so adding,
   editing, or removing a zone in the dashboard now actually shows up
   on the site instead of requiring a code change + redeploy.

   The API already returns km/fee/timeLabel precomputed per landmark
   (backend/src/lib/delivery.js, using the exact same formula as
   dmHaversineKm/dmEstimateForDistance below - kept here for parity/
   reference, not because this file still calls them), so nothing
   downstream needs to change how it reads a landmark object. */
var LANDMARKS = [];

var LANDMARKS_READY = fetch((window.API_BASE_URL || "") + "/api/delivery-landmarks")
  .then(function (res) {
    if (!res.ok) throw new Error("Failed to load delivery landmarks (" + res.status + ")");
    return res.json();
  })
  .then(function (data) {
    LANDMARKS = data.landmarks || [];
    return LANDMARKS;
  })
  .catch(function (err) {
    console.error("Could not load delivery landmarks:", err);
    return LANDMARKS;
  });

function dmFormatFee(value) {
  return value.toFixed(0) + " Br";
}

/* ---- Haversine great-circle distance, in kilometers ---- */
function dmHaversineKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ---- Estimate fee + time from straight-line distance ---- */
function dmEstimateForDistance(km) {
  var fee = Math.round((20 + km * 9) / 5) * 5;
  if (fee < 20) fee = 20;
  var lowMin = Math.round(12 + km * 5);
  var highMin = lowMin + 10;
  return { fee: fee, timeLabel: lowMin + "-" + highMin + " min", km: km };
}

/* ---- Google Maps embed URLs (key-less) ----
   Default cafe view: plain "q=" marker, satellite basemap (t=k) - fast
   to load, no extra chrome. Once a landmark is selected: a satellite
   directions (saddr/daddr) embed, which draws Google's own live driving
   route/road from the cafe to that spot. Directions mode does bring
   along Google's own small address card + drive-time bubble - that's
   a trade-off we accept here in exchange for the actual route line,
   since it only appears once someone has deliberately picked a
   landmark (our own info panel is already open at that point anyway). */
function dmCafeMapSrc() {
  return "https://www.google.com/maps?q=" + CAFE_LOCATION.lat + "," + CAFE_LOCATION.lng +
    "&z=16&t=k&output=embed";
}

function dmRouteMapSrc(spot) {
  return "https://www.google.com/maps?saddr=" + CAFE_LOCATION.lat + "," + CAFE_LOCATION.lng +
    "&daddr=" + spot.lat + "," + spot.lng + "&t=k&output=embed";
}

function dmSetMapSrc(src) {
  var frame = document.getElementById("dm-map");
  if (frame && frame.getAttribute("src") !== src) frame.setAttribute("src", src);
}

/* ---- Info panel open/close (the small icon bottom-right of the map) ---- */
function dmOpenInfoPanel() {
  var card = document.getElementById("dm-route-card");
  var toggle = document.getElementById("dm-map-info-toggle");
  if (card) card.classList.add("is-open");
  if (toggle) {
    toggle.classList.add("is-active");
    toggle.setAttribute("aria-expanded", "true");
  }
}

function dmCloseInfoPanel() {
  var card = document.getElementById("dm-route-card");
  var toggle = document.getElementById("dm-map-info-toggle");
  if (card) card.classList.remove("is-open");
  if (toggle) {
    toggle.classList.remove("is-active");
    toggle.setAttribute("aria-expanded", "false");
  }
}

function dmToggleInfoPanel() {
  var card = document.getElementById("dm-route-card");
  if (card && card.classList.contains("is-open")) dmCloseInfoPanel();
  else dmOpenInfoPanel();
}

/* ---- Landmark selection (content only; panel open state is separate) ---- */
/* Tracks the most recently selected landmark's fee (and the full spot
   object), so the "Checkout" button can pass a real delivery fee - and
   a real, human-readable drop-off point - through to the payment page
   even though the map itself doesn't have its own separate confirm
   step. */
var dmSelectedFee = null;
var dmSelectedLandmark = null;

/* Shared by delivery-map.js and food-picker.js: the little "details"
   payload payment-verification.html reads to render its delivery
   confirmation card, built from whichever landmark is selected right
   now (or null if none has been picked yet). */
function dmBuildDeliveryDetails() {
  if (!dmSelectedLandmark) return null;
  return {
    id: dmSelectedLandmark.id,
    landmark: dmSelectedLandmark.name,
    approx: !!dmSelectedLandmark.approx,
    km: dmSelectedLandmark.km,
    timeLabel: dmSelectedLandmark.timeLabel
  };
}

function dmResetRouteCardContent() {
  var titleEl = document.getElementById("dm-route-card-title");
  var kmEl = document.getElementById("dm-route-card-km");
  var timeEl = document.getElementById("dm-route-card-time");
  var feeEl = document.getElementById("dm-route-card-fee");
  if (titleEl) titleEl.textContent = "Pick a landmark below";
  if (kmEl) kmEl.textContent = "\u2014";
  if (timeEl) timeEl.textContent = "\u2014";
  if (feeEl) feeEl.textContent = "\u2014";
  dmSelectedFee = null;
  dmSelectedLandmark = null;
}

function dmClearSelection(alsoClosePanel) {
  document.querySelectorAll(".dm-landmark-chip").forEach(function (chip) {
    chip.classList.remove("is-active");
  });
  dmResetRouteCardContent();
  dmSetMapSrc(dmCafeMapSrc());
  if (alsoClosePanel) dmCloseInfoPanel();
}

function dmSelectLandmark(spot) {
  dmSetMapSrc(dmRouteMapSrc(spot));

  var titleEl = document.getElementById("dm-route-card-title");
  var kmEl = document.getElementById("dm-route-card-km");
  var timeEl = document.getElementById("dm-route-card-time");
  var feeEl = document.getElementById("dm-route-card-fee");
  if (titleEl) titleEl.textContent = spot.name + (spot.approx ? " (approx.)" : "");
  if (kmEl) kmEl.textContent = spot.km.toFixed(1) + " km";
  if (timeEl) timeEl.textContent = spot.timeLabel;
  if (feeEl) feeEl.textContent = dmFormatFee(spot.fee);
  dmSelectedFee = spot.fee;
  dmSelectedLandmark = spot;

  /* If food has already been picked in this panel (js/food-picker.js
     already tagged the cart as "delivery"), keep its saved fee AND
     drop-off details synced to whichever landmark is selected now,
     instead of only updating them the moment "Checkout" is clicked. */
  if (typeof SuccessCafeCart !== "undefined" && SuccessCafeCart.getFulfillment().method === "delivery") {
    SuccessCafeCart.setFulfillment("delivery", spot.fee, dmBuildDeliveryDetails());
  }

  /* Picking a landmark is a deliberate request to see its details, so
     reveal the info panel automatically (it stays collapsed otherwise). */
  dmOpenInfoPanel();

  document.querySelectorAll(".dm-landmark-chip").forEach(function (chip) {
    chip.classList.toggle("is-active", chip.dataset.id === spot.id);
  });
}

/* ---- Landmark chip row ---- */
function dmRenderLandmarkChips() {
  var row = document.getElementById("dm-landmarks-row");
  if (!row || row.dataset.dmInited) return;
  row.dataset.dmInited = "true";

  row.innerHTML = LANDMARKS.map(function (spot) {
    return (
      '<button type="button" class="dm-landmark-chip" data-id="' + spot.id + '">' +
        "<strong>" + spot.name + "</strong>" +
        "<span>" + spot.km.toFixed(1) + " km &middot; " + dmFormatFee(spot.fee) + "</span>" +
      "</button>"
    );
  }).join("");

  row.querySelectorAll(".dm-landmark-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var spot = LANDMARKS.filter(function (s) { return s.id === chip.dataset.id; })[0];
      if (spot) dmSelectLandmark(spot);
    });
  });
}

function dmInitMap() {
  var frame = document.getElementById("dm-map");
  if (!frame || frame.dataset.dmInited) return;
  frame.dataset.dmInited = "true";
  frame.setAttribute("src", dmCafeMapSrc());
}

document.addEventListener("DOMContentLoaded", function () {
  var overlay = document.getElementById("delivery-modal-overlay");
  if (!overlay) return;

  /* LANDMARKS now comes from a fetch, so wait for it before building
     the chip row - see the LANDMARKS_READY comment near the top. */
  LANDMARKS_READY.then(dmRenderLandmarkChips);

  /* Lazily load the map iframe the first time the panel opens, so the
     page doesn't spend a request on an embed nobody may ever see. */
  var observer = new MutationObserver(function () {
    if (overlay.classList.contains("is-open")) dmInitMap();
  });
  observer.observe(overlay, { attributes: true, attributeFilter: ["class"] });

  /* Cover the deep-link case (#delivery on page load) where the overlay
     may already be open before this observer attaches. */
  if (overlay.classList.contains("is-open")) dmInitMap();

  var resetBtn = document.getElementById("dm-map-reset");
  if (resetBtn) resetBtn.addEventListener("click", function () { dmClearSelection(false); });

  var closeBtn = document.getElementById("dm-route-card-close");
  if (closeBtn) closeBtn.addEventListener("click", function () { dmClearSelection(true); });

  var infoToggle = document.getElementById("dm-map-info-toggle");
  if (infoToggle) infoToggle.addEventListener("click", dmToggleInfoPanel);

  /* Ordering through this panel is a delivery order: mark it as such
     right before leaving for checkout, so payment-verification.html
     shows "Delivery" (with the fee) instead of "In Cafe". Falls back
     to the default fee shown in the stats strip (30-70 Br -> 50) if no
     landmark was picked. */
  var deliveryCheckoutBtn = document.getElementById("dm-checkout-btn");
  if (deliveryCheckoutBtn) {
    deliveryCheckoutBtn.addEventListener("click", function () {
      if (typeof SuccessCafeCart !== "undefined") {
        SuccessCafeCart.setFulfillment("delivery", dmSelectedFee || 50, dmBuildDeliveryDetails());
      }
    });
  }
});
