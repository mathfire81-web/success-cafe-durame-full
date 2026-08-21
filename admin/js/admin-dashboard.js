/*
  ADMIN DASHBOARD CONTROLLER - admin/dashboard.html
  Guards the page with GET /api/admin/auth/me (redirects to login.html
  if not signed in), lists orders by status tab, and drives the detail
  drawer's verify/reject/complete actions.
*/

var STATUS_LABELS = {
  pending_verification: "Pending Verification",
  confirmed: "Confirmed",
  verified: "Verified",
  rejected: "Rejected",
  completed: "Completed"
};

var activeStatus = "pending_verification";
var activeOrderId = null;

function formatMoney(value) {
  return Number(value).toFixed(0) + " Br";
}

function formatDate(iso) {
  var d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " \u00b7 " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function showToast(message) {
  var toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  setTimeout(function () { toast.classList.remove("is-visible"); }, 2600);
}

function apiFetch(url, options) {
  options = options || {};
  options.credentials = "same-origin";
  return fetch(url, options).then(function (res) {
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

/* ---- Auth guard + header ---- */
function checkAuth() {
  return apiFetch("/api/admin/auth/me").then(function (data) {
    document.getElementById("admin-username-label").textContent = data.username;
  });
}

/* ---- Orders table ---- */
function loadOrders() {
  var qs = activeStatus ? "?status=" + encodeURIComponent(activeStatus) : "";
  return apiFetch("/api/admin/orders" + qs).then(function (data) {
    renderOrdersTable(data.orders);
  });
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
    return (
      '<tr data-order-id="' + order.id + '">' +
        '<td class="order-code-cell">' + order.orderCode + "</td>" +
        "<td>" + escapeHtml(order.customerName) + "<br><small>" + escapeHtml(order.customerPhone) + "</small></td>" +
        "<td>" + (order.fulfillmentMethod === "delivery" ? "Delivery" : "In Cafe") + "</td>" +
        "<td>" + order.paymentMethod + "</td>" +
        "<td>" + formatMoney(order.total) + "</td>" +
        '<td><span class="status-pill status-' + order.status + '">' + (STATUS_LABELS[order.status] || order.status) + "</span></td>" +
        "<td>" + formatDate(order.createdAt) + "</td>" +
      "</tr>"
    );
  }).join("");
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

/* ---- Detail drawer ---- */
function openDrawer(orderId) {
  activeOrderId = orderId;
  apiFetch("/api/admin/orders/" + orderId).then(function (order) {
    renderDrawer(order);
    document.getElementById("drawer-overlay").classList.add("is-open");
  }).catch(function (err) { showToast(err.message); });
}

function closeDrawer() {
  document.getElementById("drawer-overlay").classList.remove("is-open");
  activeOrderId = null;
}

function renderDrawer(order) {
  var content = document.getElementById("drawer-content");

  var itemsHtml = order.items.map(function (item) {
    return '<li><span>' + item.qty + '&times; ' + escapeHtml(item.name) + '</span><span>' + formatMoney(item.lineTotal) + '</span></li>';
  }).join("");

  var deliveryHtml = order.fulfillmentMethod === "delivery"
    ? '<div class="drawer-row"><span>Address</span><span>' + escapeHtml(order.deliveryAddress || "\u2014") + '</span></div>' +
      '<div class="drawer-row"><span>Delivery fee</span><span>' + formatMoney(order.deliveryFee) + '</span></div>'
    : '<div class="drawer-row"><span>Fulfillment</span><span>In Cafe</span></div>';

  var proofHtml = order.hasProof
    ? '<img class="proof-thumb" src="/api/admin/orders/' + order.id + '/proof" alt="Payment proof screenshot">'
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
      '<div class="drawer-row"><span>Name</span><span>' + escapeHtml(order.customerName) + '</span></div>' +
      '<div class="drawer-row"><span>Phone</span><span>' + escapeHtml(order.customerPhone) + '</span></div>' +
      deliveryHtml +
    "</div>" +

    '<div class="drawer-section"><h3>Items</h3><ul class="drawer-items">' + itemsHtml + '</ul>' +
      '<div class="drawer-row" style="margin-top:8px; border-top:1px solid rgba(11,42,31,0.08); padding-top:8px;"><span>Total</span><span>' + formatMoney(order.total) + '</span></div>' +
    "</div>" +

    '<div class="drawer-section"><h3>Payment</h3>' +
      '<div class="drawer-row"><span>Method</span><span>' + order.paymentMethod + '</span></div>' +
      (order.txnReference ? '<div class="drawer-row"><span>Reference</span><span>' + escapeHtml(order.txnReference) + '</span></div>' : "") +
      proofHtml +
    "</div>" +

    (order.adminNote ? '<div class="drawer-section"><h3>Admin Note</h3><p style="margin:0; font-size:0.88rem;">' + escapeHtml(order.adminNote) + '</p></div>' : "") +

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
    loadOrders();
  }).catch(function (err) { showToast(err.message); });
}

document.addEventListener("DOMContentLoaded", function () {
  checkAuth().then(loadOrders).catch(function () { /* checkAuth already redirects */ });

  document.getElementById("status-tabs").addEventListener("click", function (event) {
    var btn = event.target.closest(".admin-tab");
    if (!btn) return;
    document.querySelectorAll(".admin-tab").forEach(function (t) { t.classList.remove("is-active"); });
    btn.classList.add("is-active");
    activeStatus = btn.getAttribute("data-status");
    loadOrders();
  });

  document.getElementById("orders-tbody").addEventListener("click", function (event) {
    var row = event.target.closest("tr");
    if (!row) return;
    openDrawer(row.getAttribute("data-order-id"));
  });

  document.getElementById("drawer-close").addEventListener("click", closeDrawer);
  document.getElementById("drawer-overlay").addEventListener("click", function (event) {
    if (event.target === document.getElementById("drawer-overlay")) closeDrawer();
  });

  document.getElementById("logout-btn").addEventListener("click", function () {
    apiFetch("/api/admin/auth/logout", { method: "POST" }).then(function () {
      window.location.href = "login.html";
    });
  });
});
