/*
  DELIVERY PAGE CONTROLLER - delivery.html
  Drives the sticky "route tracker" (scroll progress + step nav), the
  Leaflet map with delivery-zone circles around Durame town, and the
  live running total in the "build your order" step. Reuses
  DELIVERY_ZONES from js/delivery.js and MENU_DATA/SuccessCafeCart from
  js/menu-data.js + js/cart.js.
*/

/* Approx coordinates for Durame town, Kembata Tembaro Zone, Ethiopia
   (7.2333 N, 37.8833 E), with each zone offset a short distance from
   the town centre so the map reads as a real service area. */
var DURAME_CENTER = [7.2333, 37.8833];
var ZONE_COORDS = {
  "downtown":   { latlng: [7.2333, 37.8833], radius: 700 },
  "kebele-01":  { latlng: [7.2410, 37.8900], radius: 900 },
  "kebele-02":  { latlng: [7.2260, 37.8760], radius: 900 },
  "university": { latlng: [7.2450, 37.8760], radius: 1100 },
  "outskirts":  { latlng: [7.2150, 37.8950], radius: 1600 }
};

function dpFormatFee(value) {
  return value.toFixed(0) + " Br";
}

/* ---------------- Route tracker (sticky scroll progress) ---------------- */
function dpInitRouteTracker() {
  var fill = document.getElementById("route-track-fill");
  var scooter = document.getElementById("route-scooter");
  var stops = Array.prototype.slice.call(document.querySelectorAll(".route-stop"));
  var sections = stops.map(function (stop) {
    return document.getElementById(stop.getAttribute("data-target"));
  });

  if (!fill || !scooter || !stops.length) return;

  stops.forEach(function (stop) {
    stop.addEventListener("click", function () {
      var target = document.getElementById(stop.getAttribute("data-target"));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  function updateProgress() {
    var docEl = document.documentElement;
    var scrollTop = window.scrollY || docEl.scrollTop;
    var flowStart = sections[0] ? sections[0].offsetTop - 160 : 0;
    var flowEnd = sections[sections.length - 1]
      ? sections[sections.length - 1].offsetTop + sections[sections.length - 1].offsetHeight - window.innerHeight
      : document.body.scrollHeight;

    var progress = (scrollTop - flowStart) / Math.max(1, (flowEnd - flowStart));
    progress = Math.max(0, Math.min(1, progress));

    fill.style.width = (progress * 100) + "%";
    scooter.style.left = (progress * 100) + "%";

    var activeIndex = 0;
    sections.forEach(function (section, i) {
      if (section && scrollTop >= section.offsetTop - window.innerHeight * 0.5) {
        activeIndex = i;
      }
    });

    stops.forEach(function (stop, i) {
      stop.classList.toggle("is-active", i === activeIndex);
      stop.classList.toggle("is-done", i < activeIndex);
    });
  }

  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
  updateProgress();
}

/* ---------------- Map ---------------- */
function dpInitMap() {
  var mapEl = document.getElementById("delivery-map");
  if (!mapEl || typeof L === "undefined") return null;

  var map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true }).setView(DURAME_CENTER, 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18
  }).addTo(map);

  var cafeIcon = L.divIcon({
    className: "dp-cafe-marker",
    html: '<span></span>',
    iconSize: [18, 18]
  });
  L.marker(DURAME_CENTER, { icon: cafeIcon }).addTo(map).bindPopup("<strong>Success Cafe</strong><br>Downtown Durame");

  var circles = {};
  if (typeof DELIVERY_ZONES !== "undefined") {
    DELIVERY_ZONES.forEach(function (zone) {
      var coords = ZONE_COORDS[zone.id];
      if (!coords) return;
      var circle = L.circle(coords.latlng, {
        radius: coords.radius,
        color: "#e2691f",
        weight: 1.5,
        fillColor: "#e2691f",
        fillOpacity: 0.12
      }).addTo(map);
      circle.bindPopup(
        "<strong>" + zone.name + "</strong><br>" +
        dpFormatFee(zone.fee) + " &middot; " + zone.time
      );
      circles[zone.id] = circle;
    });
  }

  map.on("focus", function () { map.scrollWheelZoom.enable(); });
  map.on("blur", function () { map.scrollWheelZoom.disable(); });

  return { map: map, circles: circles };
}

function dpHighlightZone(mapRefs, zoneId) {
  if (!mapRefs) return;
  Object.keys(mapRefs.circles).forEach(function (id) {
    var isActive = id === zoneId;
    mapRefs.circles[id].setStyle({
      weight: isActive ? 3 : 1.5,
      fillOpacity: isActive ? 0.28 : 0.12
    });
    if (isActive) mapRefs.circles[id].bringToFront();
  });
  var coords = ZONE_COORDS[zoneId];
  if (coords) mapRefs.map.flyTo(coords.latlng, 15, { duration: 0.8 });
}

/* ---------------- Zone list <-> map sync ---------------- */
function dpWireZoneSync(mapRefs) {
  var select = document.getElementById("zone-select");
  var grid = document.getElementById("zones-grid");

  if (select) {
    select.addEventListener("change", function () {
      if (select.value) dpHighlightZone(mapRefs, select.value);
    });
  }

  if (grid) {
    grid.addEventListener("click", function (event) {
      var row = event.target.closest(".dm-zone-row");
      if (!row || typeof DELIVERY_ZONES === "undefined") return;
      var index = Array.prototype.indexOf.call(grid.children, row);
      var zone = DELIVERY_ZONES[index];
      if (!zone) return;

      Array.prototype.forEach.call(grid.children, function (el) { el.classList.remove("is-selected"); });
      row.classList.add("is-selected");
      if (select) select.value = zone.id;
      dpHighlightZone(mapRefs, zone.id);
    });
  }
}

/* ---------------- Live order total (step 2) ---------------- */
function dpUpdateLiveTotal() {
  if (typeof SuccessCafeCart === "undefined") return;
  var countEl = document.getElementById("live-total-count");
  var subtotalEl = document.getElementById("live-total-subtotal");
  var totalEl = document.getElementById("live-total-grand");

  var cart = SuccessCafeCart.getCart();
  var itemCount = cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
  var subtotal = SuccessCafeCart.getTotal();

  if (countEl) countEl.textContent = itemCount + (itemCount === 1 ? " item" : " items");
  if (subtotalEl) subtotalEl.textContent = dpFormatFee(subtotal);
  if (totalEl) totalEl.textContent = dpFormatFee(subtotal);
}

document.addEventListener("DOMContentLoaded", function () {
  dpInitRouteTracker();
  var mapRefs = dpInitMap();
  dpWireZoneSync(mapRefs);

  dpUpdateLiveTotal();
  var pickerList = document.getElementById("food-picker-list");
  if (pickerList) pickerList.addEventListener("click", function () {
    setTimeout(dpUpdateLiveTotal, 0);
  });
});
