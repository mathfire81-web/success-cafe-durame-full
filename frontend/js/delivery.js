/*
  DELIVERY JS
  Renders delivery zones (fee + estimated time) and wires the
  zone-checker form inside the floating delivery panel.
*/

var DELIVERY_ZONES = [
  { id: "downtown", name: "Downtown Durame", fee: 30, time: "20-30 min" },
  { id: "kebele-01", name: "Kebele 01", fee: 40, time: "25-35 min" },
  { id: "kebele-02", name: "Kebele 02", fee: 40, time: "25-35 min" },
  { id: "university", name: "University Area", fee: 50, time: "30-40 min" },
  { id: "outskirts", name: "Outskirts (5km+)", fee: 70, time: "40-55 min" }
];

function formatFee(value) {
  return value.toFixed(0) + " Br";
}

function renderZoneOptions() {
  var select = document.getElementById("zone-select");
  if (!select) return;
  var optionsHtml = '<option value="">Choose your area&hellip;</option>';
  DELIVERY_ZONES.forEach(function (zone) {
    optionsHtml += '<option value="' + zone.id + '">' + zone.name + "</option>";
  });
  select.innerHTML = optionsHtml;
}

function renderZoneCards() {
  var grid = document.getElementById("zones-grid");
  if (!grid) return;
  var rowsHtml = DELIVERY_ZONES.map(function (zone) {
    return (
      '<div class="dm-zone-row">' +
        '<span class="dm-zone-name">' + zone.name + "</span>" +
        '<span class="dm-zone-meta">' + formatFee(zone.fee) + " &middot; " + zone.time + "</span>" +
      "</div>"
    );
  }).join("");
  grid.innerHTML = rowsHtml;
}

function wireZoneChecker() {
  var form = document.getElementById("zone-checker-form");
  var select = document.getElementById("zone-select");
  var result = document.getElementById("zone-result");
  if (!form || !select || !result) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var zone = DELIVERY_ZONES.filter(function (z) { return z.id === select.value; })[0];

    if (!zone) {
      result.innerHTML = '<p class="checker-result-title">Please choose your area first</p>';
      result.classList.add("is-visible");
      return;
    }

    result.innerHTML =
      '<p class="checker-result-title">Good news - we deliver to ' + zone.name + '</p>' +
      '<div class="checker-result-row"><span>Delivery Fee</span><strong>' + formatFee(zone.fee) + '</strong></div>' +
      '<div class="checker-result-row"><span>Estimated Time</span><strong>' + zone.time + '</strong></div>';
    result.classList.add("is-visible");
  });
}

document.addEventListener("DOMContentLoaded", function () {
  renderZoneOptions();
  renderZoneCards();
  wireZoneChecker();
});
