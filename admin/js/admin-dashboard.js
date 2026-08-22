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
  lastFetchedAt: null
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

/* ---------------- detail drawer ---------------- */

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
    ? '<img class="proof-thumb" crossorigin="use-credentials" src="' + (window.API_BASE_URL || "") + "/api/admin/orders/" + order.id + '/proof" alt="Payment proof screenshot">'
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
  document.getElementById("header-title").textContent = view === "dashboard" ? "Dashboard" : "Orders";

  Array.prototype.forEach.call(document.querySelectorAll(".sb-link[data-view]"), function (link) {
    link.classList.toggle("is-active", link.getAttribute("data-view") === view && !link.classList.contains("sb-link--sub"));
  });

  if (view === "orders") {
    if (status !== undefined) setActiveStatus(status);
    else loadOrdersPage();
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
});
