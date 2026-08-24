/*
  ADMIN DASHBOARD CONTROLLER - admin/dashboard.html
  Guards the page with GET /api/admin/auth/me (redirects to login.html if
  not signed in). Drives two views built on the same real order data:
    - Dashboard: quick stats, charts, today's activity, recent orders.
    - Orders: full status-tab table with search/filter, pagination,
      bulk actions, CSV export and the order detail drawer.
*/

var STATUS_LABELS = {
  pending_verification: "Pending Verification",
  confirmed: "Confirmed",
  verified: "Verified",
  rejected: "Rejected",
  completed: "Completed"
};

var PREORDER_STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed"
};

var IDEA_CATEGORY_LABELS = {
  menu: "Menu",
  delivery: "Delivery",
  website: "Website",
  service: "Service",
  other: "Other"
};

var VALID_STATUSES = ["pending_verification", "verified", "confirmed", "completed", "rejected"];

var AVATAR_COLORS = ["#e2691f", "#1e5c40", "#4f8cff", "#23b3a3", "#b8541f", "#2c7350", "#c0392b", "#8a5cf6"];

var state = {
  view: "dashboard",
  status: "pending_verification",
  page: 1,
  pageSize: 10,
  total: 0,
  ordersOnPage: [],
  selected: {},
  range: 7,
  statsOrders: [],
  statusCounts: {},
  lastFetchedAt: null,

  pstatus: "pending",
  ppage: 1,
  ppageSize: 10,
  ptotal: 0,
  preordersOnPage: [],
  preorderStatusCounts: {},

  ipage: 1,
  ipageSize: 12,
  itotal: 0,
  ideasOnPage: [],

  categories: [],
  items: [],
  menuCategoryFilter: "",
  menuSearch: "",

  zones: []
};

/* ---------------- helpers ---------------- */

function formatMoney(value) {
  return Number(value).toFixed(0) + " Br";
}

function formatDate(iso) {
  var d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " \u00b7 " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function resolveImageUrl(url) {
  if (!url) return "";
  if (/^(https?:)?\/\//i.test(url) || url.indexOf("data:") === 0) return url;
  return (window.API_BASE_URL || "") + (url.charAt(0) === "/" ? url : "/" + url);
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function showToast(message) {
  var toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  setTimeout(function () { toast.classList.remove("is-visible"); }, 2600);
}

function apiFetch(url, options) {
  options = options || {};
  options.credentials = "include";
  return fetch((window.API_BASE_URL || "") + url, options).then(function (res) {
    if (res.status === 401) {
      window.location.href = "login.html";
      throw new Error("Not signed in");
    }
    return res.json().then(function (data) {
      if (!res.ok) throw new Error(data.error || "Request failed.");
      return data;
    });
  });
}

function initialsFor(name) {
  var parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].substr(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function colorFor(name) {
  var str = name || "";
  var hash = 0;
  for (var i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function markUpdated() {
  state.lastFetchedAt = new Date();
  document.getElementById("last-updated").textContent = "Updated " +
    state.lastFetchedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/* ---------------- auth ---------------- */

function checkAuth() {
  return apiFetch("/api/admin/auth/me").then(function (data) {
    document.getElementById("admin-username-label").textContent = data.username;
    document.getElementById("admin-avatar").textContent = initialsFor(data.username).substr(0, 1);
  });
}

/* ---------------- charts (hand-rolled SVG, no dependency) ---------------- */

function bucketize(orders, rangeDays, numBuckets) {
  var now = Date.now();
  var bucketMs = (rangeDays * 86400000) / numBuckets;
  var counts = new Array(numBuckets).fill(0);
  var sums = new Array(numBuckets).fill(0);
  orders.forEach(function (o) {
    var age = now - new Date(o.createdAt).getTime();
    if (age < 0 || age > rangeDays * 86400000) return;
    var idx = Math.floor(age / bucketMs);
    if (idx >= numBuckets) idx = numBuckets - 1;
    idx = numBuckets - 1 - idx; // 0 = oldest -> left of chart, last = most recent -> right
    counts[idx] += 1;
    sums[idx] += Number(o.total);
  });
  return { counts: counts, sums: sums };
}

function trendPct(values) {
  var half = Math.max(1, Math.floor(values.length / 2));
  var first = values.slice(0, half).reduce(function (a, b) { return a + b; }, 0);
  var second = values.slice(half).reduce(function (a, b) { return a + b; }, 0);
  if (first === 0 && second === 0) return { pct: 0, dir: "flat" };
  if (first === 0) return { pct: 100, dir: "up" };
  var pct = ((second - first) / first) * 100;
  return { pct: pct, dir: pct > 1 ? "up" : (pct < -1 ? "down" : "flat") };
}

function renderDelta(elId, trend) {
  var el = document.getElementById(elId);
  el.className = "stat-delta is-" + trend.dir;
  var arrow = trend.dir === "up" ? "\u2197" : (trend.dir === "down" ? "\u2198" : "\u2192");
  el.textContent = arrow + " " + Math.abs(trend.pct).toFixed(1) + "% vs earlier in period";
}

function lineChartSvg(values) {
  var w = 300, h = 100, pad = 6;
  var max = Math.max.apply(null, values.concat([1]));
  var min = Math.min.apply(null, values.concat([0]));
  var range = (max - min) || 1;
  var step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  var points = values.map(function (v, i) {
    var x = pad + i * step;
    var y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return [x, y];
  });
  var linePath = points.map(function (p, i) { return (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
  var areaPath = linePath + " L" + points[points.length - 1][0].toFixed(1) + "," + (h - pad) +
    " L" + points[0][0].toFixed(1) + "," + (h - pad) + " Z";
  var gid = "grad" + Math.random().toString(36).slice(2, 8);
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#f5a962" stop-opacity="0.35"/>' +
    '<stop offset="100%" stop-color="#f5a962" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + areaPath + '" fill="url(#' + gid + ')" stroke="none"></path>' +
    '<path d="' + linePath + '" fill="none" stroke="#f5a962" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '<circle cx="' + points[points.length - 1][0].toFixed(1) + '" cy="' + points[points.length - 1][1].toFixed(1) + '" r="3.4" fill="#f5a962"></circle>' +
    "</svg>";
}

function barChartSvg(values) {
  var w = 300, h = 100, pad = 4, gap = 6;
  var n = values.length;
  var barW = (w - pad * 2 - gap * (n - 1)) / n;
  var max = Math.max.apply(null, values.concat([1]));
  var bars = values.map(function (v, i) {
    var barH = max > 0 ? (v / max) * (h - pad * 2) : 0;
    var x = pad + i * (barW + gap);
    var y = h - pad - barH;
    var isLast = i === n - 1;
    return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(barH, 2).toFixed(1) +
      '" rx="3" fill="' + (isLast ? "#f5a962" : "rgba(245,169,98,0.35)") + '"></rect>';
  }).join("");
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' + bars + "</svg>";
}

function renderAxis(elId, rangeDays, numBuckets) {
  var el = document.getElementById(elId);
  var now = new Date();
  var oldest = new Date(now.getTime() - rangeDays * 86400000);
  var mid = new Date((oldest.getTime() + now.getTime()) / 2);
  el.innerHTML = "<span>" + formatShortDate(oldest) + "</span><span>" + formatShortDate(mid) + "</span><span>" + formatShortDate(now) + "</span>";
}

/* ---------------- dashboard view ---------------- */

function loadStatusCounts() {
  var calls = VALID_STATUSES.map(function (s) {
    return apiFetch("/api/admin/orders?status=" + s + "&pageSize=1").then(function (data) {
      state.statusCounts[s] = data.total;
    });
  });
  calls.push(apiFetch("/api/admin/orders?pageSize=1").then(function (data) {
    state.statusCounts.all = data.total;
  }));
  return Promise.all(calls).then(function () {
    document.getElementById("badge-pending").textContent = state.statusCounts.pending_verification || 0;
    VALID_STATUSES.forEach(function (s) {
      var el = document.getElementById("count-" + s);
      if (el) el.textContent = state.statusCounts[s] != null ? "(" + state.statusCounts[s] + ")" : "";
    });
    var allEl = document.getElementById("count-all");
    if (allEl) allEl.textContent = state.statusCounts.all != null ? "(" + state.statusCounts.all + ")" : "";
    renderChipRow();
  });
}

function renderChipRow() {
  var row = document.getElementById("chip-row");
  var chips = [
    { status: "pending_verification", label: "Awaiting Verification", color: "var(--status-amber)" },
    { status: "verified", label: "Verified", color: "var(--status-blue)" },
    { status: "confirmed", label: "Confirmed (Cash)", color: "var(--status-teal)" },
    { status: "completed", label: "Completed", color: "var(--status-green)" },
    { status: "rejected", label: "Rejected", color: "var(--status-red)" }
  ];
  row.innerHTML = chips.map(function (c) {
    var n = state.statusCounts[c.status] != null ? state.statusCounts[c.status] : "\u2014";
    return '<div class="chip" data-status="' + c.status + '">' +
      '<span class="chip-num" style="color:' + c.color + '">' + n + "</span>" +
      '<span class="chip-label">' + c.label + "</span></div>";
  }).join("");
  Array.prototype.forEach.call(row.querySelectorAll(".chip"), function (chip) {
    chip.addEventListener("click", function () {
      switchView("orders", chip.getAttribute("data-status"));
    });
  });
}

function loadStatsOrders() {
  return apiFetch("/api/admin/orders?pageSize=100").then(function (data) {
    state.statsOrders = data.orders;
    renderDashboard();
  });
}

function renderDashboard() {
  var numBuckets = state.range <= 7 ? state.range : (state.range <= 30 ? 10 : 15);
  var bucketed = bucketize(state.statsOrders, state.range, numBuckets);

  var totalOrdersInRange = bucketed.counts.reduce(function (a, b) { return a + b; }, 0);
  var totalRevenueInRange = bucketed.sums.reduce(function (a, b) { return a + b; }, 0);

  document.getElementById("stat-orders-count").textContent = totalOrdersInRange;
  document.getElementById("stat-revenue-total").textContent = formatMoney(totalRevenueInRange);

  renderDelta("stat-orders-delta", trendPct(bucketed.counts));
  renderDelta("stat-revenue-delta", trendPct(bucketed.sums));

  document.getElementById("chart-orders").innerHTML = lineChartSvg(bucketed.counts);
  document.getElementById("chart-revenue").innerHTML = barChartSvg(bucketed.sums);
  renderAxis("axis-orders", state.range, numBuckets);
  renderAxis("axis-revenue", state.range, numBuckets);

  renderRecentOrders();
  renderTodayPromo();
}

function renderRecentOrders() {
  var tbody = document.getElementById("recent-orders-tbody");
  var empty = document.getElementById("recent-empty");
  var recent = state.statsOrders.slice(0, 6);

  if (!recent.length) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = recent.map(function (order) {
    return '<tr data-order-id="' + order.id + '">' +
      '<td class="order-code-cell">' + order.orderCode + "</td>" +
      "<td>" + escapeHtml(order.customerName) + "</td>" +
      "<td>" + (order.fulfillmentMethod === "delivery" ? "Delivery" : "In Cafe") + "</td>" +
      "<td>" + order.paymentMethod + "</td>" +
      "<td>" + formatMoney(order.total) + "</td>" +
      '<td><span class="status-pill status-' + order.status + '">' + (STATUS_LABELS[order.status] || order.status) + "</span></td>" +
      "<td>" + formatDate(order.createdAt) + "</td>" +
      "</tr>";
  }).join("");

  Array.prototype.forEach.call(tbody.querySelectorAll("tr"), function (row) {
    row.addEventListener("click", function () { openDrawer(row.getAttribute("data-order-id")); });
  });
}

function renderTodayPromo() {
  var now = new Date();
  var todayStr = now.toDateString();
  var todayCount = state.statsOrders.filter(function (o) { return new Date(o.createdAt).toDateString() === todayStr; }).length;

  var oldest = state.statsOrders.length ? new Date(state.statsOrders[state.statsOrders.length - 1].createdAt) : now;
  var daySpan = Math.max(1, Math.round((now - oldest) / 86400000));
  var avgPerDay = state.statsOrders.length / daySpan;
  var target = Math.max(5, Math.ceil(avgPerDay * 1.25));

  document.getElementById("sb-promo-fill").style.width = Math.min(100, (todayCount / target) * 100) + "%";
  document.getElementById("sb-promo-text").textContent = todayCount + " of ~" + target + " orders so far today, based on recent activity.";
}

/* ---------------- orders view ---------------- */

function loadOrdersPage() {
  var qs = "?pageSize=" + state.pageSize + "&page=" + state.page;
  if (state.status) qs += "&status=" + encodeURIComponent(state.status);
  return apiFetch("/api/admin/orders" + qs).then(function (data) {
    state.ordersOnPage = data.orders;
    state.total = data.total;
    state.selected = {};
    updateBulkBar();
    applyClientFiltersAndRender();
    renderPagination();
    markUpdated();
  });
}

function getFiltered() {
  var text = (document.getElementById("orders-search").value || "").toLowerCase().trim();
  var fulfillment = document.getElementById("filter-fulfillment").value;
  var payment = document.getElementById("filter-payment").value;
  return state.ordersOnPage.filter(function (o) {
    if (fulfillment && o.fulfillmentMethod !== fulfillment) return false;
    if (payment && o.paymentMethod !== payment) return false;
    if (text) {
      var hay = (o.orderCode + " " + o.customerName + " " + o.customerPhone).toLowerCase();
      if (hay.indexOf(text) === -1) return false;
    }
    return true;
  });
}

function applyClientFiltersAndRender() {
  renderOrdersTable(getFiltered());
}

function renderOrdersTable(orders) {
  var tbody = document.getElementById("orders-tbody");
  var empty = document.getElementById("orders-empty");
  var table = document.getElementById("orders-table");

  if (!orders.length) {
    tbody.innerHTML = "";
    table.style.display = "none";
    empty.style.display = "block";
    return;
  }
  table.style.display = "";
  empty.style.display = "none";

  tbody.innerHTML = orders.map(function (order) {
    var checked = state.selected[order.id] ? "checked" : "";
    return (
      '<tr data-order-id="' + order.id + '">' +
        '<td class="col-check"><input type="checkbox" class="row-check" data-id="' + order.id + '" ' + checked + "></td>" +
        '<td class="order-code-cell">' + order.orderCode + "</td>" +
        '<td><div class="cust-cell"><span class="avatar-badge" style="background:' + colorFor(order.customerName) + '">' + initialsFor(order.customerName) + "</span>" +
          "<span>" + escapeHtml(order.customerName) + "<br><small>" + escapeHtml(order.customerPhone) + "</small></span></div></td>" +
        "<td>" + (order.fulfillmentMethod === "delivery" ? "Delivery" : "In Cafe") + "</td>" +
        "<td>" + order.paymentMethod + "</td>" +
        "<td>" + formatMoney(order.total) + "</td>" +
        '<td><span class="status-pill status-' + order.status + '">' + (STATUS_LABELS[order.status] || order.status) + "</span></td>" +
        "<td>" + formatDate(order.createdAt) + "</td>" +
        '<td><button type="button" class="row-view-btn" data-id="' + order.id + '" title="View"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button></td>' +
      "</tr>"
    );
  }).join("");
}

function renderPagination() {
  var summary = document.getElementById("pagination-summary");
  var controls = document.getElementById("pagination-controls");
  var totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  var from = state.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  var to = Math.min(state.page * state.pageSize, state.total);
  summary.textContent = "Showing " + from + " to " + to + " of " + state.total + " entries";

  var html = '<button type="button" class="page-btn" data-page="' + (state.page - 1) + '" ' + (state.page <= 1 ? "disabled" : "") + '>&lsaquo;</button>';

  var pages = [];
  for (var p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - state.page) <= 1) pages.push(p);
  }
  var lastShown = 0;
  pages.forEach(function (p) {
    if (lastShown && p - lastShown > 1) html += '<span class="page-ellipsis">&hellip;</span>';
    html += '<button type="button" class="page-btn ' + (p === state.page ? "is-active" : "") + '" data-page="' + p + '">' + p + "</button>";
    lastShown = p;
  });

  html += '<button type="button" class="page-btn" data-page="' + (state.page + 1) + '" ' + (state.page >= totalPages ? "disabled" : "") + '>&rsaquo;</button>';
  controls.innerHTML = html;

  Array.prototype.forEach.call(controls.querySelectorAll(".page-btn:not([disabled])"), function (btn) {
    btn.addEventListener("click", function () {
      state.page = parseInt(btn.getAttribute("data-page"), 10);
      loadOrdersPage();
    });
  });
}

/* ---- bulk actions ---- */

function updateBulkBar() {
  var ids = Object.keys(state.selected).filter(function (id) { return state.selected[id]; });
  var bar = document.getElementById("bulk-bar");
  var actionBtn = document.getElementById("bulk-action-btn");

  if (!ids.length) { bar.style.display = "none"; return; }
  bar.style.display = "flex";
  document.getElementById("bulk-count").textContent = ids.length + " selected";

  if (state.status === "pending_verification") {
    actionBtn.textContent = "Verify Selected";
    actionBtn.style.display = "";
  } else if (state.status === "verified" || state.status === "confirmed") {
    actionBtn.textContent = "Mark Selected Completed";
    actionBtn.style.display = "";
  } else {
    actionBtn.style.display = "none";
  }
}

function runBulkAction() {
  var ids = Object.keys(state.selected).filter(function (id) { return state.selected[id]; });
  if (!ids.length) return;
  var action = state.status === "pending_verification" ? "verify" : "complete";
  var calls = ids.map(function (id) {
    return apiFetch("/api/admin/orders/" + id + "/" + action, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
    }).catch(function () { return null; });
  });
  Promise.all(calls).then(function () {
    showToast(ids.length + " order(s) updated.");
    loadOrdersPage();
    loadStatusCounts();
  });
}

/* ---- CSV export ---- */

function exportCsv() {
  var qs = "?pageSize=100";
  if (state.status) qs += "&status=" + encodeURIComponent(state.status);
  apiFetch("/api/admin/orders" + qs).then(function (data) {
    var rows = [["Order Code", "Customer", "Phone", "Fulfillment", "Payment", "Total", "Status", "Placed"]];
    data.orders.forEach(function (o) {
      rows.push([o.orderCode, o.customerName, o.customerPhone, o.fulfillmentMethod, o.paymentMethod, o.total, o.status, o.createdAt]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (cell) { return '"' + String(cell == null ? "" : cell).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "orders-" + (state.status || "all") + "-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Exported " + data.orders.length + " order(s).");
  }).catch(function (err) { showToast(err.message); });
}

/* ---------------- generic pagination (ideas + preorders) ---------------- */

function renderGenericPagination(summaryElId, controlsElId, page, pageSize, total, onPageChange) {
  var summary = document.getElementById(summaryElId);
  var controls = document.getElementById(controlsElId);
  var totalPages = Math.max(1, Math.ceil(total / pageSize));
  var from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  var to = Math.min(page * pageSize, total);
  summary.textContent = "Showing " + from + " to " + to + " of " + total + " entries";

  var html = '<button type="button" class="page-btn" data-page="' + (page - 1) + '" ' + (page <= 1 ? "disabled" : "") + '>&lsaquo;</button>';
  var pages = [];
  for (var p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
  }
  var lastShown = 0;
  pages.forEach(function (p) {
    if (lastShown && p - lastShown > 1) html += '<span class="page-ellipsis">&hellip;</span>';
    html += '<button type="button" class="page-btn ' + (p === page ? "is-active" : "") + '" data-page="' + p + '">' + p + "</button>";
    lastShown = p;
  });
  html += '<button type="button" class="page-btn" data-page="' + (page + 1) + '" ' + (page >= totalPages ? "disabled" : "") + '>&rsaquo;</button>';
  controls.innerHTML = html;

  Array.prototype.forEach.call(controls.querySelectorAll(".page-btn:not([disabled])"), function (btn) {
    btn.addEventListener("click", function () { onPageChange(parseInt(btn.getAttribute("data-page"), 10)); });
  });
}

/* ---------------- pre-orders view ---------------- */

var PREORDER_STATUSES = ["pending", "confirmed", "completed", "cancelled"];

function loadPreorderStatusCounts() {
  var calls = PREORDER_STATUSES.map(function (s) {
    return apiFetch("/api/admin/preorders?status=" + s + "&pageSize=1").then(function (data) {
      state.preorderStatusCounts[s] = data.total;
    });
  });
  calls.push(apiFetch("/api/admin/preorders?pageSize=1").then(function (data) {
    state.preorderStatusCounts.all = data.total;
  }));
  return Promise.all(calls).then(function () {
    document.getElementById("badge-preorder-pending").textContent = state.preorderStatusCounts.pending || 0;
    PREORDER_STATUSES.forEach(function (s) {
      var el = document.getElementById("pcount-" + s);
      if (el) el.textContent = state.preorderStatusCounts[s] != null ? "(" + state.preorderStatusCounts[s] + ")" : "";
    });
    var allEl = document.getElementById("pcount-all");
    if (allEl) allEl.textContent = state.preorderStatusCounts.all != null ? "(" + state.preorderStatusCounts.all + ")" : "";
  });
}

function setActivePreorderStatus(status) {
  state.pstatus = status;
  state.ppage = 1;
  Array.prototype.forEach.call(document.querySelectorAll("#preorder-status-tabs .admin-tab"), function (t) {
    t.classList.toggle("is-active", t.getAttribute("data-pstatus") === status);
  });
  loadPreordersPage();
}

function loadPreordersPage() {
  var qs = "?pageSize=" + state.ppageSize + "&page=" + state.ppage;
  if (state.pstatus) qs += "&status=" + encodeURIComponent(state.pstatus);
  return apiFetch("/api/admin/preorders" + qs).then(function (data) {
    state.preordersOnPage = data.preorders;
    state.ptotal = data.total;
    applyPreorderFiltersAndRender();
    renderGenericPagination("preorders-pagination-summary", "preorders-pagination-controls", state.ppage, state.ppageSize, state.ptotal, function (p) {
      state.ppage = p;
      loadPreordersPage();
    });
    markUpdated();
  });
}

function getFilteredPreorders() {
  var text = (document.getElementById("preorders-search").value || "").toLowerCase().trim();
  if (!text) return state.preordersOnPage;
  return state.preordersOnPage.filter(function (p) {
    var hay = (p.preorderCode + " " + p.customerName + " " + p.customerPhone).toLowerCase();
    return hay.indexOf(text) !== -1;
  });
}

function applyPreorderFiltersAndRender() {
  renderPreordersTable(getFilteredPreorders());
}

function renderPreordersTable(preorders) {
  var tbody = document.getElementById("preorders-tbody");
  var empty = document.getElementById("preorders-empty");
  var table = document.getElementById("preorders-table");

  if (!preorders.length) {
    tbody.innerHTML = "";
    table.style.display = "none";
    empty.style.display = "block";
    return;
  }
  table.style.display = "";
  empty.style.display = "none";

  tbody.innerHTML = preorders.map(function (p) {
    var when = p.reservationDate ? formatShortDate(new Date(p.reservationDate)) + (p.reservationTime ? " \u00b7 " + p.reservationTime : "") : "\u2014";
    return (
      '<tr data-preorder-id="' + p.id + '">' +
        '<td class="order-code-cell">' + p.preorderCode + "</td>" +
        '<td><div class="cust-cell"><span class="avatar-badge" style="background:' + colorFor(p.customerName) + '">' + initialsFor(p.customerName) + "</span>" +
          "<span>" + escapeHtml(p.customerName) + "<br><small>" + escapeHtml(p.customerPhone) + "</small></span></div></td>" +
        "<td>" + when + "</td>" +
        "<td>" + p.guests + "</td>" +
        "<td>" + (p.itemCount > 0 ? p.itemCount + " item(s)" : "Decide on arrival") + "</td>" +
        '<td><span class="status-pill status-' + p.status + '">' + (PREORDER_STATUS_LABELS[p.status] || p.status) + "</span></td>" +
        "<td>" + formatDate(p.createdAt) + "</td>" +
        '<td><button type="button" class="row-view-btn" data-id="' + p.id + '" title="View"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button></td>' +
      "</tr>"
    );
  }).join("");
}

function openPreorderDrawer(id) {
  apiFetch("/api/admin/preorders/" + id).then(function (preorder) {
    renderPreorderDrawer(preorder);
    document.getElementById("drawer-overlay").classList.add("is-open");
  }).catch(function (err) { showToast(err.message); });
}

function renderPreorderDrawer(p) {
  var content = document.getElementById("drawer-content");

  var itemsHtml = p.items.length
    ? p.items.map(function (item) {
        return "<li><span>" + item.qty + "&times; " + escapeHtml(item.name) + "</span><span>" + formatMoney(item.lineTotal) + "</span></li>";
      }).join("")
    : "<li><span>No food selected \u2014 deciding on arrival</span></li>";

  var when = p.reservationDate ? formatShortDate(new Date(p.reservationDate)) + (p.reservationTime ? " at " + p.reservationTime : "") : "\u2014";

  var proofHtml = p.hasProof
    ? '<img class="proof-thumb" id="preorder-proof-thumb-img" alt="Payment proof screenshot">'
    : '<p class="no-proof">No screenshot attached.</p>';

  var actionsHtml = "";
  if (p.status === "pending") {
    actionsHtml =
      '<textarea class="drawer-note" id="preorder-note" placeholder="Note (optional)"></textarea>' +
      '<div class="drawer-actions">' +
        '<button type="button" class="drawer-btn reject" id="preorder-cancel-btn">Cancel</button>' +
        '<button type="button" class="drawer-btn verify" id="preorder-confirm-btn">Confirm</button>' +
      "</div>";
  } else if (p.status === "confirmed") {
    actionsHtml =
      '<textarea class="drawer-note" id="preorder-note" placeholder="Note (optional)"></textarea>' +
      '<div class="drawer-actions">' +
        '<button type="button" class="drawer-btn reject" id="preorder-cancel-btn">Cancel</button>' +
        '<button type="button" class="drawer-btn complete" id="preorder-complete-btn">Mark Completed</button>' +
      "</div>";
  }

  content.innerHTML =
    "<h2>" + p.preorderCode + "</h2>" +
    '<p class="drawer-sub"><span class="status-pill status-' + p.status + '">' + (PREORDER_STATUS_LABELS[p.status] || p.status) + "</span> &middot; " + formatDate(p.createdAt) + "</p>" +

    '<div class="drawer-section"><h3>Customer</h3>' +
      '<div class="drawer-row"><span>Name</span><span>' + escapeHtml(p.customerName) + "</span></div>" +
      '<div class="drawer-row"><span>Phone</span><span>' + escapeHtml(p.customerPhone) + "</span></div>" +
      '<div class="drawer-row"><span>Table for</span><span>' + p.guests + "</span></div>" +
      '<div class="drawer-row"><span>Reservation</span><span>' + when + "</span></div>" +
    "</div>" +

    '<div class="drawer-section"><h3>Food</h3><ul class="drawer-items">' + itemsHtml + "</ul>" +
      (p.items.length ? '<div class="drawer-row" style="margin-top:8px; border-top:1px solid rgba(245,241,230,0.1); padding-top:8px;"><span>Subtotal</span><span>' + formatMoney(p.subtotal) + "</span></div>" : "") +
    "</div>" +

    (p.notes ? '<div class="drawer-section"><h3>Special Requests</h3><p style="margin:0; font-size:0.88rem;">' + escapeHtml(p.notes) + "</p></div>" : "") +
    (p.adminNote ? '<div class="drawer-section"><h3>Admin Note</h3><p style="margin:0; font-size:0.88rem;">' + escapeHtml(p.adminNote) + "</p></div>" : "") +

    '<div class="drawer-section"><h3>Payment Screenshot</h3>' +
      '<p class="drawer-hint" style="margin:0 0 4px; font-size:0.8rem; color:var(--dash-text-faint);">Optional \u2014 only present if the guest already sent a deposit.</p>' +
      proofHtml +
    "</div>" +

    actionsHtml;

  var confirmBtn = document.getElementById("preorder-confirm-btn");
  var cancelBtn = document.getElementById("preorder-cancel-btn");
  var completeBtn = document.getElementById("preorder-complete-btn");

  if (confirmBtn) confirmBtn.addEventListener("click", function () { runPreorderAction(p.id, "confirmed"); });
  if (cancelBtn) cancelBtn.addEventListener("click", function () { runPreorderAction(p.id, "cancelled"); });
  if (completeBtn) completeBtn.addEventListener("click", function () { runPreorderAction(p.id, "completed"); });

  if (p.hasProof) loadPreorderProofImage(p.id);
}

function loadPreorderProofImage(preorderId) {
  var imgEl = document.getElementById("preorder-proof-thumb-img");
  if (!imgEl) return;
  fetch((window.API_BASE_URL || "") + "/api/admin/preorders/" + preorderId + "/proof", { credentials: "include" })
    .then(function (res) {
      if (!res.ok) throw new Error("Failed to load proof (" + res.status + ")");
      return res.blob();
    })
    .then(function (blob) {
      imgEl.src = URL.createObjectURL(blob);
    })
    .catch(function () {
      var fallback = document.createElement("p");
      fallback.className = "no-proof";
      fallback.textContent = "Couldn't load screenshot.";
      if (imgEl.parentNode) imgEl.parentNode.replaceChild(fallback, imgEl);
    });
}

function runPreorderAction(id, status) {
  var noteEl = document.getElementById("preorder-note");
  apiFetch("/api/admin/preorders/" + id + "/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: status, note: noteEl ? noteEl.value : "" })
  }).then(function () {
    showToast("Reservation " + status + ".");
    closeDrawer();
    if (state.view === "preorders") loadPreordersPage();
    loadPreorderStatusCounts();
  }).catch(function (err) { showToast(err.message); });
}

/* ---------------- ideas view ---------------- */

function loadIdeasPage() {
  var qs = "?pageSize=" + state.ipageSize + "&page=" + state.ipage;
  return apiFetch("/api/admin/ideas" + qs).then(function (data) {
    state.ideasOnPage = data.ideas;
    state.itotal = data.total;
    document.getElementById("badge-ideas-total").textContent = data.total;
    applyIdeaFiltersAndRender();
    renderGenericPagination("ideas-pagination-summary", "ideas-pagination-controls", state.ipage, state.ipageSize, state.itotal, function (p) {
      state.ipage = p;
      loadIdeasPage();
    });
    markUpdated();
  });
}

function getFilteredIdeas() {
  var text = (document.getElementById("ideas-search").value || "").toLowerCase().trim();
  var category = document.getElementById("filter-idea-category").value;
  return state.ideasOnPage.filter(function (idea) {
    if (category && idea.category !== category) return false;
    if (text) {
      var hay = (idea.name + " " + idea.email + " " + idea.message).toLowerCase();
      if (hay.indexOf(text) === -1) return false;
    }
    return true;
  });
}

function applyIdeaFiltersAndRender() {
  renderIdeasGrid(getFilteredIdeas());
}

function renderIdeasGrid(ideas) {
  var grid = document.getElementById("ideas-grid");
  var empty = document.getElementById("ideas-empty");

  if (!ideas.length) {
    grid.innerHTML = "";
    grid.style.display = "none";
    empty.style.display = "block";
    return;
  }
  grid.style.display = "";
  empty.style.display = "none";

  grid.innerHTML = ideas.map(function (idea) {
    return (
      '<div class="idea-card">' +
        '<div class="idea-card-head">' +
          '<div class="idea-card-who">' +
            '<span class="idea-card-name">' + escapeHtml(idea.name) + "</span>" +
            '<span class="idea-card-email">' + escapeHtml(idea.email) + "</span>" +
          "</div>" +
          '<span class="idea-cat cat-' + idea.category + '">' + (IDEA_CATEGORY_LABELS[idea.category] || idea.category) + "</span>" +
        "</div>" +
        '<p class="idea-card-message">' + escapeHtml(idea.message) + "</p>" +
        '<span class="idea-card-date">' + formatDate(idea.createdAt) + "</span>" +
      "</div>"
    );
  }).join("");
}

/* ---------------- detail drawer ---------------- */

/* ---------------- menu management ---------------- */

function loadMenuData() {
  return Promise.all([
    apiFetch("/api/admin/menu/categories"),
    apiFetch("/api/admin/menu/items")
  ]).then(function (results) {
    state.categories = results[0].categories;
    state.items = results[1].items;
    renderCategoryTabs();
    applyMenuFiltersAndRender();
    markUpdated();
  });
}

function renderCategoryTabs() {
  var bar = document.getElementById("menu-cat-tabs");
  var html = '<button type="button" class="menu-cat-tab ' + (state.menuCategoryFilter === "" ? "is-active" : "") + '" data-cat="">All Items</button>';
  html += state.categories.map(function (cat) {
    var count = state.items.filter(function (i) { return i.categoryId === cat.id; }).length;
    return (
      '<button type="button" class="menu-cat-tab ' + (state.menuCategoryFilter === String(cat.id) ? "is-active" : "") + '" data-cat="' + cat.id + '">' +
        escapeHtml(cat.name) + " (" + count + ")" +
        ' <span class="cat-edit" data-edit-cat="' + cat.id + '" title="Edit category">\u270e</span>' +
      "</button>"
    );
  }).join("");
  bar.innerHTML = html;
}

function applyMenuFiltersAndRender() {
  var text = state.menuSearch.toLowerCase();
  var filtered = state.items.filter(function (item) {
    if (state.menuCategoryFilter && String(item.categoryId) !== state.menuCategoryFilter) return false;
    if (text) {
      var hay = (item.name + " " + (item.description || "")).toLowerCase();
      if (hay.indexOf(text) === -1) return false;
    }
    return true;
  });
  renderMenuItemsGrid(filtered);
}

function renderMenuItemsGrid(items) {
  var grid = document.getElementById("menu-items-grid");
  var empty = document.getElementById("menu-items-empty");
  if (!items.length) {
    grid.innerHTML = "";
    grid.style.display = "none";
    empty.style.display = "block";
    return;
  }
  grid.style.display = "";
  empty.style.display = "none";

  grid.innerHTML = items.map(function (item) {
    var img = item.image ? '<img class="menu-item-card-img" src="' + resolveImageUrl(item.image) + '" alt="">' : '<div class="menu-item-card-img"></div>';
    return (
      '<div class="menu-item-card ' + (item.isAvailable ? "" : "is-unavailable") + '" data-item-id="' + item.id + '">' +
        '<button type="button" class="menu-item-card-avail ' + (item.isAvailable ? "is-on" : "") + '" data-toggle-id="' + item.id + '" data-current="' + item.isAvailable + '" title="Toggle availability"><span></span></button>' +
        img +
        '<div class="menu-item-card-body">' +
          (item.badge ? '<span class="menu-item-card-badge">' + escapeHtml(item.badge) + "</span>" : "") +
          '<div class="menu-item-card-top"><span class="menu-item-card-name">' + escapeHtml(item.name) + "</span>" +
            '<span class="menu-item-card-price">' + formatMoney(item.price) + "</span></div>" +
          '<span class="menu-item-card-desc">' + escapeHtml(item.description || "") + "</span>" +
          (item.isAvailable ? "" : '<span class="menu-item-card-badge" style="color:var(--status-red);">Unavailable</span>') +
        "</div>" +
      "</div>"
    );
  }).join("");
}

function openCategoryDrawer(category) {
  var isNew = !category;
  var content = document.getElementById("drawer-content");
  content.innerHTML =
    "<h2>" + (isNew ? "Add Category" : "Edit Category") + "</h2>" +
    '<p class="form-error" id="cat-form-error"></p>' +
    '<div class="form-field"><label>Name</label><input type="text" id="cat-name" value="' + (category ? escapeHtml(category.name) : "") + '"></div>' +
    '<div class="form-field"><label>Amharic Name (optional)</label><input type="text" id="cat-name-am" value="' + (category ? escapeHtml(category.nameAm || "") : "") + '"></div>' +
    '<div class="form-field"><label>Sort Order</label><input type="number" id="cat-sort" value="' + (category ? category.sortOrder : 0) + '"></div>' +
    '<div class="drawer-actions">' +
      (isNew ? "" : '<button type="button" class="drawer-btn reject" id="cat-delete-btn">Delete</button>') +
      '<button type="button" class="drawer-btn verify" id="cat-save-btn">' + (isNew ? "Add" : "Save") + "</button>" +
    "</div>";

  document.getElementById("cat-save-btn").addEventListener("click", function () {
    var errEl = document.getElementById("cat-form-error");
    var body = {
      name: document.getElementById("cat-name").value.trim(),
      nameAm: document.getElementById("cat-name-am").value.trim(),
      sortOrder: document.getElementById("cat-sort").value
    };
    var req = isNew
      ? apiFetch("/api/admin/menu/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : apiFetch("/api/admin/menu/categories/" + category.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    req.then(function () {
      closeDrawer();
      showToast(isNew ? "Category added." : "Category updated.");
      loadMenuData();
    }).catch(function (err) {
      errEl.textContent = err.message;
      errEl.classList.add("is-visible");
    });
  });

  var deleteBtn = document.getElementById("cat-delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", function () {
      if (!confirm('Delete category "' + category.name + '"?')) return;
      apiFetch("/api/admin/menu/categories/" + category.id, { method: "DELETE" }).then(function () {
        closeDrawer();
        showToast("Category deleted.");
        loadMenuData();
      }).catch(function (err) {
        var errEl = document.getElementById("cat-form-error");
        errEl.textContent = err.message;
        errEl.classList.add("is-visible");
      });
    });
  }

  document.getElementById("drawer-overlay").classList.add("is-open");
}

function openItemDrawer(item) {
  var isNew = !item;
  var content = document.getElementById("drawer-content");
  var catOptions = state.categories.map(function (cat) {
    var selected = item && item.categoryId === cat.id ? "selected" : (!item && state.menuCategoryFilter === String(cat.id) ? "selected" : "");
    return '<option value="' + cat.id + '" ' + selected + ">" + escapeHtml(cat.name) + "</option>";
  }).join("");

  content.innerHTML =
    "<h2>" + (isNew ? "Add Item" : "Edit Item") + "</h2>" +
    '<p class="form-error" id="item-form-error"></p>' +
    '<div class="form-field"><label>Name</label><input type="text" id="item-name" value="' + (item ? escapeHtml(item.name) : "") + '"></div>' +
    '<div class="form-field"><label>Amharic Name (optional)</label><input type="text" id="item-name-am" value="' + (item ? escapeHtml(item.nameAm || "") : "") + '"></div>' +
    '<div class="form-field"><label>Category</label><select id="item-category">' + catOptions + "</select></div>" +
    '<div class="form-row">' +
      '<div class="form-field"><label>Price (ETB)</label><input type="number" id="item-price" step="0.01" value="' + (item ? item.price : "") + '"></div>' +
      '<div class="form-field"><label>Badge (optional)</label><input type="text" id="item-badge" placeholder="New, Popular..." value="' + (item ? escapeHtml(item.badge || "") : "") + '"></div>' +
    "</div>" +
    '<div class="form-field"><label>Description</label><textarea id="item-description">' + (item ? escapeHtml(item.description || "") : "") + "</textarea></div>" +
    '<div class="form-field"><label>Photo</label>' +
      '<div class="photo-upload-row">' +
        '<img class="photo-preview" id="item-photo-preview" src="' + (item && item.image ? escapeHtml(resolveImageUrl(item.image)) : "") + '" onerror="this.style.visibility=\'hidden\'" onload="this.style.visibility=\'visible\'">' +
        '<button type="button" class="btn btn--outline photo-upload-btn" id="item-photo-upload-btn">Upload Photo</button>' +
        '<input type="file" id="item-photo-file" accept="image/*" style="display:none;">' +
      "</div>" +
      '<input type="text" id="item-image" placeholder="Or paste an image URL" value="' + (item ? escapeHtml(item.image || "") : "") + '" style="margin-top:8px;">' +
      '<div class="photo-upload-status" id="item-photo-status"></div>' +
    "</div>" +
    '<div class="form-check"><input type="checkbox" id="item-available" ' + (!item || item.isAvailable ? "checked" : "") + '> <label for="item-available" style="margin:0;">Available on the menu</label></div>' +
    '<div class="drawer-actions">' +
      (isNew ? "" : '<button type="button" class="drawer-btn reject" id="item-delete-btn">Delete</button>') +
      '<button type="button" class="drawer-btn verify" id="item-save-btn">' + (isNew ? "Add" : "Save") + "</button>" +
    "</div>";

  document.getElementById("item-save-btn").addEventListener("click", function () {
    var errEl = document.getElementById("item-form-error");
    var body = {
      name: document.getElementById("item-name").value.trim(),
      nameAm: document.getElementById("item-name-am").value.trim(),
      categoryId: document.getElementById("item-category").value,
      price: document.getElementById("item-price").value,
      badge: document.getElementById("item-badge").value.trim(),
      description: document.getElementById("item-description").value.trim(),
      image: document.getElementById("item-image").value.trim(),
      isAvailable: document.getElementById("item-available").checked
    };
    var req = isNew
      ? apiFetch("/api/admin/menu/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : apiFetch("/api/admin/menu/items/" + item.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    req.then(function () {
      closeDrawer();
      showToast(isNew ? "Item added." : "Item updated.");
      loadMenuData();
    }).catch(function (err) {
      errEl.textContent = err.message;
      errEl.classList.add("is-visible");
    });
  });

  var deleteBtn = document.getElementById("item-delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", function () {
      if (!confirm('Delete "' + item.name + '"?')) return;
      apiFetch("/api/admin/menu/items/" + item.id, { method: "DELETE" }).then(function () {
        closeDrawer();
        showToast("Item deleted.");
        loadMenuData();
      }).catch(function (err) {
        var errEl = document.getElementById("item-form-error");
        errEl.textContent = err.message;
        errEl.classList.add("is-visible");
      });
    });
  }

  var uploadBtn = document.getElementById("item-photo-upload-btn");
  var fileInput = document.getElementById("item-photo-file");
  var statusEl = document.getElementById("item-photo-status");
  uploadBtn.addEventListener("click", function () { fileInput.click(); });
  fileInput.addEventListener("change", function () {
    var file = fileInput.files[0];
    if (!file) return;
    statusEl.textContent = "Uploading...";
    uploadBtn.disabled = true;
    var formData = new FormData();
    formData.append("photo", file);
    apiFetch("/api/admin/menu/photo", { method: "POST", body: formData })
      .then(function (data) {
        document.getElementById("item-image").value = data.url;
        document.getElementById("item-photo-preview").src = resolveImageUrl(data.url);
        statusEl.textContent = "Uploaded.";
      })
      .catch(function (err) { statusEl.textContent = err.message; })
      .then(function () { uploadBtn.disabled = false; });
  });

  document.getElementById("drawer-overlay").classList.add("is-open");
}

/* ---------------- delivery zones ---------------- */

var CAFE_LOCATION = { lat: 7.2449066412107825, lng: 37.90079484003493 };
var zonesMapInstance = null;
var zonesMapMarkers = [];

function renderZonesMap(zones) {
  if (typeof L === "undefined") return; // Leaflet failed to load (offline CDN, etc.) - map is a nice-to-have, not required
  if (!zonesMapInstance) {
    zonesMapInstance = L.map("zones-map").setView([CAFE_LOCATION.lat, CAFE_LOCATION.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    }).addTo(zonesMapInstance);
    L.marker([CAFE_LOCATION.lat, CAFE_LOCATION.lng], {
      icon: L.divIcon({ className: "", html: '<div style="background:#e2691f;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #e2691f;"></div>', iconSize: [16, 16] })
    }).addTo(zonesMapInstance).bindPopup("<b>Success Cafe</b>");
  }

  zonesMapMarkers.forEach(function (m) { zonesMapInstance.removeLayer(m); });
  zonesMapMarkers = zones.map(function (z) {
    var marker = L.marker([z.lat, z.lng]).addTo(zonesMapInstance);
    marker.bindPopup("<b>" + escapeHtml(z.name) + "</b>" + z.km + " km &middot; " + formatMoney(z.fee));
    marker.on("click", function () { openZoneDrawer(z); });
    return marker;
  });

  // Fit the map to show the cafe + all zones, so a new zone far away is never hidden off-screen.
  if (zones.length) {
    var bounds = L.latLngBounds([[CAFE_LOCATION.lat, CAFE_LOCATION.lng]].concat(zones.map(function (z) { return [z.lat, z.lng]; })));
    zonesMapInstance.fitBounds(bounds, { padding: [30, 30] });
  }
  setTimeout(function () { zonesMapInstance.invalidateSize(); }, 100);
}

function loadZones() {
  return apiFetch("/api/admin/delivery-zones").then(function (data) {
    state.zones = data.landmarks;
    applyZoneFiltersAndRender();
    renderZonesMap(state.zones);
    markUpdated();
  });
}

function applyZoneFiltersAndRender() {
  var text = (document.getElementById("zones-search").value || "").toLowerCase();
  var filtered = state.zones.filter(function (z) { return !text || z.name.toLowerCase().indexOf(text) !== -1; });
  renderZonesTable(filtered);
}

function renderZonesTable(zones) {
  var tbody = document.getElementById("zones-tbody");
  var empty = document.getElementById("zones-empty");
  var table = document.getElementById("zones-table");
  if (!zones.length) {
    tbody.innerHTML = "";
    table.style.display = "none";
    empty.style.display = "block";
    return;
  }
  table.style.display = "";
  empty.style.display = "none";

  tbody.innerHTML = zones.map(function (z) {
    return (
      '<tr data-zone-id="' + z.id + '">' +
        "<td>" + escapeHtml(z.name) + (z.approx ? ' <small style="color:var(--dash-text-faint);">(approx.)</small>' : "") + "</td>" +
        "<td><small>" + z.lat + ", " + z.lng + "</small></td>" +
        "<td>" + z.km + " km</td>" +
        "<td>" + formatMoney(z.fee) + "</td>" +
        "<td>" + z.timeLabel + "</td>" +
        '<td><button type="button" class="row-view-btn" data-id="' + z.id + '" title="Edit"><svg viewBox="0 0 24 24"><path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8L17.3 5.5a2 2 0 0 0-2.8 0L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button></td>' +
      "</tr>"
    );
  }).join("");
}

function openZoneDrawer(zone) {
  var isNew = !zone;
  var content = document.getElementById("drawer-content");
  content.innerHTML =
    "<h2>" + (isNew ? "Add Delivery Zone" : "Edit Delivery Zone") + "</h2>" +
    '<p class="drawer-sub">Fee and time are calculated automatically from distance to the caf\u00e9 \u2014 you only set the location.</p>' +
    '<p class="form-error" id="zone-form-error"></p>' +
    '<div class="form-field"><label>Zone ID (URL-safe, used internally)</label><input type="text" id="zone-id" value="' + (zone ? escapeHtml(zone.id) : "") + '" placeholder="auto-generated from name if left blank"></div>' +
    '<div class="form-field"><label>Name</label><input type="text" id="zone-name" value="' + (zone ? escapeHtml(zone.name) : "") + '"></div>' +
    '<div class="form-row">' +
      '<div class="form-field"><label>Latitude</label><input type="number" step="0.000001" id="zone-lat" value="' + (zone ? zone.lat || "" : "") + '"></div>' +
      '<div class="form-field"><label>Longitude</label><input type="number" step="0.000001" id="zone-lng" value="' + (zone ? zone.lng || "" : "") + '"></div>' +
    "</div>" +
    '<div class="form-check"><input type="checkbox" id="zone-approx" ' + (zone && zone.approx ? "checked" : "") + '> <label for="zone-approx" style="margin:0;">Approximate location</label></div>' +
    '<div class="drawer-actions">' +
      (isNew ? "" : '<button type="button" class="drawer-btn reject" id="zone-delete-btn">Delete</button>') +
      '<button type="button" class="drawer-btn verify" id="zone-save-btn">' + (isNew ? "Add" : "Save") + "</button>" +
    "</div>";

  document.getElementById("zone-save-btn").addEventListener("click", function () {
    var errEl = document.getElementById("zone-form-error");
    var idFieldValue = document.getElementById("zone-id").value.trim();
    var body = {
      name: document.getElementById("zone-name").value.trim(),
      lat: document.getElementById("zone-lat").value,
      lng: document.getElementById("zone-lng").value,
      approx: document.getElementById("zone-approx").checked
    };
    if (isNew) {
      body.id = idFieldValue;
    } else if (idFieldValue && idFieldValue !== zone.id) {
      body.newId = idFieldValue;
    }
    var req = isNew
      ? apiFetch("/api/admin/delivery-zones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : apiFetch("/api/admin/delivery-zones/" + zone.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    req.then(function () {
      closeDrawer();
      showToast(isNew ? "Zone added." : "Zone updated.");
      loadZones();
    }).catch(function (err) {
      errEl.textContent = err.message;
      errEl.classList.add("is-visible");
    });
  });

  var deleteBtn = document.getElementById("zone-delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", function () {
      if (!confirm('Delete delivery zone "' + zone.name + '"?')) return;
      apiFetch("/api/admin/delivery-zones/" + zone.id, { method: "DELETE" }).then(function () {
        closeDrawer();
        showToast("Zone deleted.");
        loadZones();
      }).catch(function (err) {
        var errEl = document.getElementById("zone-form-error");
        errEl.textContent = err.message;
        errEl.classList.add("is-visible");
      });
    });
  }

  document.getElementById("drawer-overlay").classList.add("is-open");
}

function openDrawer(orderId) {
  apiFetch("/api/admin/orders/" + orderId).then(function (order) {
    renderDrawer(order);
    document.getElementById("drawer-overlay").classList.add("is-open");
  }).catch(function (err) { showToast(err.message); });
}

function closeDrawer() {
  document.getElementById("drawer-overlay").classList.remove("is-open");
}

function renderDrawer(order) {
  var content = document.getElementById("drawer-content");

  var itemsHtml = order.items.map(function (item) {
    return "<li><span>" + item.qty + "&times; " + escapeHtml(item.name) + "</span><span>" + formatMoney(item.lineTotal) + "</span></li>";
  }).join("");

  var deliveryHtml = order.fulfillmentMethod === "delivery"
    ? '<div class="drawer-row"><span>Address</span><span>' + escapeHtml(order.deliveryAddress || "\u2014") + "</span></div>" +
      '<div class="drawer-row"><span>Delivery fee</span><span>' + formatMoney(order.deliveryFee) + "</span></div>"
    : '<div class="drawer-row"><span>Fulfillment</span><span>In Cafe</span></div>';

  var proofHtml = order.hasProof
    ? '<img class="proof-thumb" id="proof-thumb-img" alt="Payment proof screenshot">'
    : '<p class="no-proof">No screenshot uploaded (cash order).</p>';

  var actionsHtml = "";
  if (order.status === "pending_verification") {
    actionsHtml =
      '<textarea class="drawer-note" id="reject-reason" placeholder="Reason if rejecting (optional)"></textarea>' +
      '<div class="drawer-actions">' +
        '<button type="button" class="drawer-btn reject" id="reject-btn">Reject</button>' +
        '<button type="button" class="drawer-btn verify" id="verify-btn">Verify</button>' +
      "</div>";
  } else if (order.status === "verified" || order.status === "confirmed") {
    actionsHtml = '<div class="drawer-actions"><button type="button" class="drawer-btn complete" id="complete-btn">Mark Completed</button></div>';
  }

  content.innerHTML =
    "<h2>" + order.orderCode + "</h2>" +
    '<p class="drawer-sub"><span class="status-pill status-' + order.status + '">' + (STATUS_LABELS[order.status] || order.status) + "</span> &middot; " + formatDate(order.createdAt) + "</p>" +

    '<div class="drawer-section"><h3>Customer</h3>' +
      '<div class="drawer-row"><span>Name</span><span>' + escapeHtml(order.customerName) + "</span></div>" +
      '<div class="drawer-row"><span>Phone</span><span>' + escapeHtml(order.customerPhone) + "</span></div>" +
      deliveryHtml +
    "</div>" +

    '<div class="drawer-section"><h3>Items</h3><ul class="drawer-items">' + itemsHtml + "</ul>" +
      '<div class="drawer-row" style="margin-top:8px; border-top:1px solid rgba(245,241,230,0.1); padding-top:8px;"><span>Total</span><span>' + formatMoney(order.total) + "</span></div>" +
    "</div>" +

    '<div class="drawer-section"><h3>Payment</h3>' +
      '<div class="drawer-row"><span>Method</span><span>' + order.paymentMethod + "</span></div>" +
      (order.txnReference ? '<div class="drawer-row"><span>Reference</span><span>' + escapeHtml(order.txnReference) + "</span></div>" : "") +
      proofHtml +
    "</div>" +

    (order.adminNote ? '<div class="drawer-section"><h3>Admin Note</h3><p style="margin:0; font-size:0.88rem;">' + escapeHtml(order.adminNote) + "</p></div>" : "") +

    actionsHtml;

  var verifyBtn = document.getElementById("verify-btn");
  var rejectBtn = document.getElementById("reject-btn");
  var completeBtn = document.getElementById("complete-btn");

  if (verifyBtn) verifyBtn.addEventListener("click", function () { runAction(order.id, "verify"); });
  if (rejectBtn) rejectBtn.addEventListener("click", function () {
    var reason = document.getElementById("reject-reason").value;
    runAction(order.id, "reject", { reason: reason });
  });
  if (completeBtn) completeBtn.addEventListener("click", function () { runAction(order.id, "complete"); });

  if (order.hasProof) loadProofImage(order.id);
}

function loadProofImage(orderId) {
  var imgEl = document.getElementById("proof-thumb-img");
  if (!imgEl) return;
  fetch((window.API_BASE_URL || "") + "/api/admin/orders/" + orderId + "/proof", { credentials: "include" })
    .then(function (res) {
      if (!res.ok) throw new Error("Failed to load proof (" + res.status + ")");
      return res.blob();
    })
    .then(function (blob) {
      imgEl.src = URL.createObjectURL(blob);
    })
    .catch(function () {
      var fallback = document.createElement("p");
      fallback.className = "no-proof";
      fallback.textContent = "Couldn't load screenshot.";
      if (imgEl.parentNode) imgEl.parentNode.replaceChild(fallback, imgEl);
    });
}

function runAction(orderId, action, body) {
  apiFetch("/api/admin/orders/" + orderId + "/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  }).then(function () {
    showToast("Order " + action + "ed.");
    closeDrawer();
    if (state.view === "orders") loadOrdersPage();
    loadStatusCounts();
    loadStatsOrders();
  }).catch(function (err) { showToast(err.message); });
}

/* ---------------- view switching ---------------- */

function switchView(view, status) {
  state.view = view;
  document.getElementById("view-dashboard").style.display = view === "dashboard" ? "" : "none";
  document.getElementById("view-orders").style.display = view === "orders" ? "" : "none";
  document.getElementById("view-preorders").style.display = view === "preorders" ? "" : "none";
  document.getElementById("view-ideas").style.display = view === "ideas" ? "" : "none";
  document.getElementById("view-menu").style.display = view === "menu" ? "" : "none";
  document.getElementById("view-delivery").style.display = view === "delivery" ? "" : "none";
  document.getElementById("header-title").textContent =
    view === "dashboard" ? "Dashboard" :
    view === "orders" ? "Orders" :
    view === "preorders" ? "Pre-Orders" :
    view === "ideas" ? "Ideas" :
    view === "menu" ? "Menu Management" :
    view === "delivery" ? "Delivery Zones" : "";

  Array.prototype.forEach.call(document.querySelectorAll(".sb-link[data-view]"), function (link) {
    link.classList.toggle("is-active", link.getAttribute("data-view") === view && !link.classList.contains("sb-link--sub"));
  });

  if (view === "orders") {
    if (status !== undefined) setActiveStatus(status);
    else loadOrdersPage();
  } else if (view === "preorders") {
    loadPreordersPage();
    loadPreorderStatusCounts();
  } else if (view === "ideas") {
    loadIdeasPage();
  } else if (view === "menu") {
    loadMenuData();
  } else if (view === "delivery") {
    loadZones();
  }
  closeSidebarMobile();
}

function setActiveStatus(status) {
  state.status = status;
  state.page = 1;
  Array.prototype.forEach.call(document.querySelectorAll(".admin-tab"), function (t) {
    t.classList.toggle("is-active", t.getAttribute("data-status") === status);
  });
  loadOrdersPage();
}

function closeSidebarMobile() {
  document.getElementById("dash-sidebar").classList.remove("is-open");
  document.getElementById("sidebar-backdrop").classList.remove("is-open");
}

/* ---------------- init ---------------- */

document.addEventListener("DOMContentLoaded", function () {
  checkAuth()
    .then(function () { return loadStatusCounts(); })
    .then(function () { return loadPreorderStatusCounts(); })
    .then(function () { return loadStatsOrders(); })
    .then(function () { markUpdated(); })
    .catch(function () { /* checkAuth already redirects on 401 */ });

  /* Sidebar nav */
  Array.prototype.forEach.call(document.querySelectorAll(".sb-link[data-view]"), function (link) {
    link.addEventListener("click", function () {
      var view = link.getAttribute("data-view");
      var status = link.getAttribute("data-status");
      switchView(view, status !== null ? status : undefined);
    });
  });

  /* "View Storefront" needs the actual frontend origin, not a relative
     path - this admin dashboard and the storefront are two separate
     Vercel deployments (see js/api-config.js for the same pattern). */
  var storefrontLink = document.getElementById("storefront-link");
  if (storefrontLink) {
    storefrontLink.href =
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "http://localhost:3000/"
        : "https://success-cafe-durame.vercel.app/";
  }

  document.getElementById("view-all-orders").addEventListener("click", function () { switchView("orders", state.status); });

  /* Sidebar + main search both filter by keyword; sidebar search jumps to Orders view */
  document.getElementById("sidebar-search").addEventListener("input", function (e) {
    document.getElementById("orders-search").value = e.target.value;
    if (state.view !== "orders") switchView("orders", state.status);
    else applyClientFiltersAndRender();
  });

  /* Range toggle */
  document.getElementById("range-toggle").addEventListener("click", function (event) {
    var btn = event.target.closest(".range-btn");
    if (!btn) return;
    Array.prototype.forEach.call(document.querySelectorAll(".range-btn"), function (b) { b.classList.remove("is-active"); });
    btn.classList.add("is-active");
    state.range = parseInt(btn.getAttribute("data-range"), 10);
    renderDashboard();
  });

  /* Promo dismiss */
  document.getElementById("sb-promo-close").addEventListener("click", function () {
    document.getElementById("sb-promo").style.display = "none";
  });

  /* Settings placeholder */
  document.getElementById("settings-btn").addEventListener("click", function () {
    showToast("Signed in as " + (document.getElementById("admin-username-label").textContent || "admin") + ". More settings coming soon.");
  });

  /* Header actions */
  document.getElementById("refresh-btn").addEventListener("click", function () {
    loadStatusCounts();
    loadStatsOrders().then(markUpdated);
    if (state.view === "orders") loadOrdersPage();
    showToast("Refreshed.");
  });

  document.getElementById("logout-btn").addEventListener("click", function () {
    apiFetch("/api/admin/auth/logout", { method: "POST" }).then(function () {
      window.location.href = "login.html";
    });
  });

  /* Mobile sidebar toggle */
  document.getElementById("sidebar-toggle").addEventListener("click", function () {
    document.getElementById("dash-sidebar").classList.add("is-open");
    document.getElementById("sidebar-backdrop").classList.add("is-open");
  });
  document.getElementById("sidebar-backdrop").addEventListener("click", closeSidebarMobile);

  /* Status tabs */
  document.getElementById("status-tabs").addEventListener("click", function (event) {
    var btn = event.target.closest(".admin-tab");
    if (!btn) return;
    setActiveStatus(btn.getAttribute("data-status"));
  });

  /* Orders search / filters */
  document.getElementById("orders-search").addEventListener("input", applyClientFiltersAndRender);
  document.getElementById("filter-fulfillment").addEventListener("change", applyClientFiltersAndRender);
  document.getElementById("filter-payment").addEventListener("change", applyClientFiltersAndRender);

  document.getElementById("export-btn").addEventListener("click", exportCsv);
  document.getElementById("refresh-orders-btn").addEventListener("click", function () { loadOrdersPage(); loadStatusCounts(); });

  /* Table interactions: row click opens drawer, checkbox selects, view button opens drawer */
  document.getElementById("orders-tbody").addEventListener("click", function (event) {
    var checkbox = event.target.closest(".row-check");
    if (checkbox) {
      event.stopPropagation();
      state.selected[checkbox.getAttribute("data-id")] = checkbox.checked;
      updateBulkBar();
      return;
    }
    var viewBtn = event.target.closest(".row-view-btn");
    if (viewBtn) {
      event.stopPropagation();
      openDrawer(viewBtn.getAttribute("data-id"));
      return;
    }
    var row = event.target.closest("tr");
    if (row) openDrawer(row.getAttribute("data-order-id"));
  });

  document.getElementById("select-all").addEventListener("change", function (e) {
    getFiltered().forEach(function (o) { state.selected[o.id] = e.target.checked; });
    applyClientFiltersAndRender();
    updateBulkBar();
  });

  document.getElementById("bulk-action-btn").addEventListener("click", runBulkAction);
  document.getElementById("bulk-clear-btn").addEventListener("click", function () {
    state.selected = {};
    applyClientFiltersAndRender();
    updateBulkBar();
  });

  /* Drawer close */
  document.getElementById("drawer-close").addEventListener("click", closeDrawer);
  document.getElementById("drawer-overlay").addEventListener("click", function (event) {
    if (event.target === document.getElementById("drawer-overlay")) closeDrawer();
  });

  /* Pre-orders: status tabs, search, refresh, row click opens drawer */
  document.getElementById("preorder-status-tabs").addEventListener("click", function (event) {
    var btn = event.target.closest(".admin-tab");
    if (!btn) return;
    setActivePreorderStatus(btn.getAttribute("data-pstatus"));
  });
  document.getElementById("preorders-search").addEventListener("input", applyPreorderFiltersAndRender);
  document.getElementById("refresh-preorders-btn").addEventListener("click", function () { loadPreordersPage(); loadPreorderStatusCounts(); });
  document.getElementById("preorders-tbody").addEventListener("click", function (event) {
    var viewBtn = event.target.closest(".row-view-btn");
    if (viewBtn) { event.stopPropagation(); openPreorderDrawer(viewBtn.getAttribute("data-id")); return; }
    var row = event.target.closest("tr");
    if (row) openPreorderDrawer(row.getAttribute("data-preorder-id"));
  });

  /* Ideas: search, category filter, refresh */
  document.getElementById("ideas-search").addEventListener("input", applyIdeaFiltersAndRender);
  document.getElementById("filter-idea-category").addEventListener("change", applyIdeaFiltersAndRender);
  document.getElementById("refresh-ideas-btn").addEventListener("click", loadIdeasPage);

  /* Menu management: category tabs, search, add buttons, item card click opens edit drawer */
  document.getElementById("menu-cat-tabs").addEventListener("click", function (event) {
    var editIcon = event.target.closest("[data-edit-cat]");
    if (editIcon) {
      event.stopPropagation();
      var cat = state.categories.filter(function (c) { return String(c.id) === editIcon.getAttribute("data-edit-cat"); })[0];
      if (cat) openCategoryDrawer(cat);
      return;
    }
    var tab = event.target.closest(".menu-cat-tab");
    if (!tab) return;
    state.menuCategoryFilter = tab.getAttribute("data-cat") || "";
    renderCategoryTabs();
    applyMenuFiltersAndRender();
  });
  document.getElementById("menu-items-search").addEventListener("input", function () {
    state.menuSearch = this.value;
    applyMenuFiltersAndRender();
  });
  document.getElementById("add-category-btn").addEventListener("click", function () { openCategoryDrawer(null); });
  document.getElementById("add-item-btn").addEventListener("click", function () {
    if (!state.categories.length) { showToast("Add a category first."); return; }
    openItemDrawer(null);
  });
  document.getElementById("menu-items-grid").addEventListener("click", function (event) {
    var toggleBtn = event.target.closest(".menu-item-card-avail");
    if (toggleBtn) {
      event.stopPropagation();
      var newState = toggleBtn.getAttribute("data-current") !== "true";
      apiFetch("/api/admin/menu/items/" + toggleBtn.getAttribute("data-toggle-id") + "/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: newState })
      }).then(function () {
        loadMenuData();
      }).catch(function (err) { showToast(err.message); });
      return;
    }
    var card = event.target.closest(".menu-item-card");
    if (!card) return;
    var item = state.items.filter(function (i) { return i.id === card.getAttribute("data-item-id"); })[0];
    if (item) openItemDrawer(item);
  });

  /* Delivery zones: search, add, row click opens edit drawer */
  document.getElementById("zones-search").addEventListener("input", applyZoneFiltersAndRender);
  document.getElementById("add-zone-btn").addEventListener("click", function () { openZoneDrawer(null); });
  document.getElementById("zones-tbody").addEventListener("click", function (event) {
    var viewBtn = event.target.closest(".row-view-btn");
    var row = event.target.closest("tr");
    if (!row) return;
    var zone = state.zones.filter(function (z) { return z.id === row.getAttribute("data-zone-id"); })[0];
    if (zone) openZoneDrawer(zone);
  });
});
