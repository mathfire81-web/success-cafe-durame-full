/*
  PAYMENT VERIFICATION JS - payment-verification.html
  Reads the cart + fulfillment choice saved from wherever checkout was
  started (see SuccessCafeCart.setFulfillment in cart.js: the delivery
  panel's Checkout button marks it "delivery", the cart drawer's
  Checkout button - used from the menu page - marks it "in-cafe"),
  renders a read-only order summary, handles payment-method selection
  (with the right instructions + transaction reference field per
  method), and submits the order to the backend (POST /api/orders)
  for real persistence + manual verification by an admin.
*/

var PAYMENT_NOTES = {
  telebirr: {
    requiresRef: true,
    note: "<strong>Pay with Telebirr</strong>Send payment to 0912 345 678 (Success Cafe), then enter the transaction reference below."
  },
  cbebirr: {
    requiresRef: true,
    note: "<strong>Pay with CBE Birr</strong>Send payment to account 1000 234 567 890 (Success Cafe), then enter the transaction reference below."
  },
  bank: {
    requiresRef: true,
    note: "<strong>Bank Transfer</strong>Transfer to Commercial Bank of Ethiopia, Success Cafe, Acc No. 1000 234 567 890, then enter the reference number below."
  },
  cash: {
    requiresRef: false,
    note: "<strong>Cash</strong>Pay in cash when your order is ready for pickup or delivery. No transaction reference needed."
  }
};

function formatMoney(value) {
  return value.toFixed(0) + " Br";
}

/* ---- Payment proof photo upload ---- */
var paymentProofDataUrl = null;
var paymentProofFileName = null;
var paymentProofFile = null; // the raw File - what actually gets uploaded
var MAX_PROOF_SIZE = 8 * 1024 * 1024; // 8MB

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function showProofError(message) {
  var uploadField = document.getElementById("upload-field");
  var dropzone = document.getElementById("upload-dropzone");
  if (uploadField) uploadField.classList.add("has-error");
  var subEl = dropzone ? dropzone.querySelector(".upload-dropzone-sub") : null;
  if (subEl) subEl.textContent = message;
}

function clearProofError() {
  var uploadField = document.getElementById("upload-field");
  var dropzone = document.getElementById("upload-dropzone");
  if (uploadField) uploadField.classList.remove("has-error");
  var subEl = dropzone ? dropzone.querySelector(".upload-dropzone-sub") : null;
  if (subEl) subEl.textContent = "Screenshot or photo of your receipt \u00b7 JPG or PNG, up to 8MB";
}

function setPaymentProof(file) {
  if (!file) return;

  if (file.type.indexOf("image/") !== 0) {
    showProofError("Please upload an image file (JPG or PNG).");
    return;
  }
  if (file.size > MAX_PROOF_SIZE) {
    showProofError("That image is too large - please keep it under 8MB.");
    return;
  }

  clearProofError();

  paymentProofFile = file;

  var reader = new FileReader();
  reader.onload = function (event) {
    paymentProofDataUrl = event.target.result;
    paymentProofFileName = file.name;

    var previewImg = document.getElementById("upload-preview-img");
    var previewBox = document.getElementById("upload-preview");
    var fileNameEl = document.getElementById("upload-file-name");
    var dropzone = document.getElementById("upload-dropzone");

    if (previewImg) previewImg.src = paymentProofDataUrl;
    if (fileNameEl) fileNameEl.textContent = file.name + " \u00b7 " + formatFileSize(file.size);
    if (previewBox) previewBox.classList.add("is-visible");
    if (dropzone) dropzone.style.display = "none";
  };
  reader.readAsDataURL(file);
}

function clearPaymentProof() {
  paymentProofDataUrl = null;
  paymentProofFileName = null;
  paymentProofFile = null;

  var fileInput = document.getElementById("field-proof");
  var previewBox = document.getElementById("upload-preview");
  var dropzone = document.getElementById("upload-dropzone");

  if (fileInput) fileInput.value = "";
  if (previewBox) previewBox.classList.remove("is-visible");
  if (dropzone) dropzone.style.display = "";
}

function wirePaymentProofUpload() {
  var dropzone = document.getElementById("upload-dropzone");
  var fileInput = document.getElementById("field-proof");
  var removeBtn = document.getElementById("upload-remove");

  if (fileInput) {
    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) setPaymentProof(fileInput.files[0]);
    });
  }

  if (dropzone) {
    ["dragenter", "dragover"].forEach(function (evtName) {
      dropzone.addEventListener(evtName, function (event) {
        event.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });
    ["dragleave", "drop"].forEach(function (evtName) {
      dropzone.addEventListener(evtName, function (event) {
        event.preventDefault();
        dropzone.classList.remove("is-dragover");
      });
    });
    dropzone.addEventListener("drop", function (event) {
      var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) setPaymentProof(file);
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      clearPaymentProof();
    });
  }
}

function getSelectedPaymentMethod() {
  var checked = document.querySelector('input[name="payment-method"]:checked');
  return checked ? checked.value : "telebirr";
}

function readSavedFulfillment() {
  if (typeof SuccessCafeCart !== "undefined" && SuccessCafeCart.getFulfillment) {
    return SuccessCafeCart.getFulfillment();
  }
  try {
    var saved = JSON.parse(localStorage.getItem("successCafeFulfillment"));
    if (saved && saved.method) return saved;
  } catch (e) { /* ignore */ }
  return { method: "in-cafe", fee: 0 };
}

function updatePaymentMethodUI() {
  var method = getSelectedPaymentMethod();
  var config = PAYMENT_NOTES[method] || PAYMENT_NOTES.cash;
  var noteEl = document.getElementById("payment-note");
  var txnField = document.getElementById("txn-reference-field");
  var uploadField = document.getElementById("upload-field");

  if (noteEl) {
    noteEl.innerHTML = config.note;
    noteEl.classList.add("is-visible");
  }
  if (txnField) {
    txnField.classList.toggle("is-visible", config.requiresRef);
  }
  if (uploadField) {
    uploadField.classList.toggle("is-visible", config.requiresRef);
  }
}

/* Turns a fulfillment.details object (see js/delivery-map.js) into the
   plain-text address string actually submitted with the order, so the
   confirmation still reads sensibly even outside this page (e.g. in a
   future order-history view or receipt). */
function formatDeliveryAddress(details) {
  if (!details || !details.landmark) return "";
  var text = "Near " + details.landmark + (details.approx ? " (approx.)" : "") + ", Durame town";
  if (typeof details.km === "number") text += " \u2014 " + details.km.toFixed(1) + " km from Success Cafe";
  return text;
}

function updateFulfillmentFieldsUI(fulfillment) {
  var addressField = document.getElementById("address-field");
  var pickupNote = document.getElementById("pickup-note");
  var confirmCard = document.getElementById("delivery-confirm-card");
  var missingCard = document.getElementById("delivery-confirm-missing");
  var hiddenAddress = document.getElementById("field-address");
  var isDelivery = fulfillment.method === "delivery";

  if (addressField) addressField.style.display = isDelivery ? "" : "none";
  if (pickupNote) pickupNote.style.display = isDelivery ? "none" : "";
  if (!isDelivery) return;

  var details = fulfillment.details;
  var hasLandmark = !!(details && details.landmark);

  if (confirmCard) confirmCard.style.display = hasLandmark ? "" : "none";
  if (missingCard) missingCard.style.display = hasLandmark ? "none" : "";

  if (hasLandmark) {
    var landmarkEl = document.getElementById("dcc-landmark");
    var distanceEl = document.getElementById("dcc-distance");
    var timeEl = document.getElementById("dcc-time");
    var feeEl = document.getElementById("dcc-fee");
    if (landmarkEl) landmarkEl.textContent = details.landmark + (details.approx ? " (approx.)" : "");
    if (distanceEl) distanceEl.textContent = (typeof details.km === "number" ? details.km.toFixed(1) : "\u2014") + " km";
    if (timeEl) timeEl.textContent = details.timeLabel || "\u2014";
    if (feeEl) feeEl.textContent = formatMoney(fulfillment.fee || 0) + " delivery";
  }

  if (hiddenAddress) hiddenAddress.value = hasLandmark ? formatDeliveryAddress(details) : "";
}

function renderSummary() {
  if (typeof SuccessCafeCart === "undefined") return;

  var cart = SuccessCafeCart.getCart();
  var fulfillment = readSavedFulfillment();

  var listEl = document.getElementById("summary-items-list");
  if (listEl) {
    listEl.innerHTML = cart.map(function (item) {
      return (
        '<li class="summary-item-line">' +
          '<span class="item-name"><span class="item-qty">' + item.qty + "&times;</span>" + item.name + "</span>" +
          '<span class="item-price">' + formatMoney(item.price * item.qty) + "</span>" +
        "</li>"
      );
    }).join("");
  }

  var subtotal = SuccessCafeCart.getTotal();
  var deliveryFee = fulfillment.method === "delivery" ? (fulfillment.fee || 50) : 0;
  var total = subtotal + deliveryFee;

  var fulfillmentEl = document.getElementById("summary-fulfillment");
  var subtotalEl = document.getElementById("summary-subtotal");
  var deliveryEl = document.getElementById("summary-delivery");
  var totalEl = document.getElementById("summary-total");

  if (fulfillmentEl) fulfillmentEl.textContent = fulfillment.method === "delivery" ? "Delivery" : "In Cafe";
  if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
  if (deliveryEl) deliveryEl.textContent = deliveryFee > 0 ? formatMoney(deliveryFee) : (fulfillment.method === "delivery" ? "Free" : "\u2014");
  if (totalEl) totalEl.textContent = formatMoney(total);

  updateFulfillmentFieldsUI(fulfillment);
}

function clearFieldErrors(form) {
  form.querySelectorAll(".form-input, .form-textarea").forEach(function (el) {
    el.style.borderColor = "";
  });
  var errorEl = document.getElementById("form-error");
  if (errorEl) {
    errorEl.classList.remove("is-visible");
    // A previous submit attempt may have overwritten this with a
    // server error message (e.g. "item no longer available") - reset
    // it back to the generic validation copy before the next check.
    if (errorEl.dataset.defaultText) errorEl.textContent = errorEl.dataset.defaultText;
  }
  clearProofError();
}

function markFieldInvalid(el) {
  el.style.borderColor = "#c0392b";
}

function validateForm(form, fulfillment) {
  clearFieldErrors(form);
  var firstInvalid = null;

  var name = form.querySelector("#field-name");
  var phone = form.querySelector("#field-phone");
  var address = form.querySelector("#field-address");
  var txn = form.querySelector("#field-txn");

  if (!name.value.trim()) { markFieldInvalid(name); firstInvalid = firstInvalid || name; }
  if (!phone.value.trim()) { markFieldInvalid(phone); firstInvalid = firstInvalid || phone; }

  if (fulfillment.method === "delivery" && !address.value.trim()) {
    var missingCard = document.getElementById("delivery-confirm-missing");
    var missingLink = missingCard ? missingCard.querySelector("a") : null;
    firstInvalid = firstInvalid || missingLink || address;
  }

  var method = getSelectedPaymentMethod();
  var config = PAYMENT_NOTES[method] || PAYMENT_NOTES.cash;
  if (config.requiresRef && !txn.value.trim()) {
    markFieldInvalid(txn);
    firstInvalid = firstInvalid || txn;
  }

  if (config.requiresRef && !paymentProofDataUrl) {
    showProofError("Please upload a screenshot of your payment to continue.");
    var dropzone = document.getElementById("upload-dropzone");
    if (!firstInvalid && dropzone) firstInvalid = dropzone.querySelector('input[type="file"]');
  } else {
    clearProofError();
  }

  if (firstInvalid) {
    var errorEl = document.getElementById("form-error");
    if (errorEl) errorEl.classList.add("is-visible");
    firstInvalid.focus();
    return false;
  }
  return true;
}

function submitOrder(fulfillment) {
  var cart = SuccessCafeCart.getCart();
  var form = document.getElementById("payment-form");
  var method = getSelectedPaymentMethod();

  var formData = new FormData();
  formData.append("name", form.querySelector("#field-name").value.trim());
  formData.append("phone", form.querySelector("#field-phone").value.trim());
  formData.append("fulfillmentMethod", fulfillment.method);
  formData.append("paymentMethod", method);
  formData.append("txnReference", form.querySelector("#field-txn").value.trim());
  formData.append(
    "items",
    JSON.stringify(cart.map(function (item) { return { id: item.id, qty: item.qty }; }))
  );
  if (fulfillment.method === "delivery" && fulfillment.details && fulfillment.details.id) {
    formData.append("landmarkId", fulfillment.details.id);
  }
  if (paymentProofFile) formData.append("proof", paymentProofFile);

  return fetch((window.API_BASE_URL || "") + "/api/orders", { method: "POST", body: formData }).then(function (res) {
    return res.json().then(function (data) {
      if (!res.ok) throw new Error(data.error || "Something went wrong placing your order.");
      return data;
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  if (typeof SuccessCafeCart === "undefined") return;

  var layout = document.getElementById("payment-layout");
  var checkoutPanel = document.getElementById("checkout-panel");
  var emptyPanel = document.getElementById("payment-empty");
  var cart = SuccessCafeCart.getCart();

  if (cart.length === 0) {
    if (checkoutPanel) checkoutPanel.style.display = "none";
    if (layout) layout.classList.add("is-empty");
    if (emptyPanel) emptyPanel.classList.add("is-visible");
    SuccessCafeCart.updateCartBadge();
    return;
  }

  renderSummary();
  updatePaymentMethodUI();
  wirePaymentProofUpload();

  var methodRadios = document.querySelectorAll('input[name="payment-method"]');
  methodRadios.forEach(function (radio) {
    radio.addEventListener("change", updatePaymentMethodUI);
  });

  var form = document.getElementById("payment-form");
  var verifyBtn = document.getElementById("verify-btn");
  var confirmationPanel = document.getElementById("confirmation-panel");
  var summarySide = document.getElementById("payment-summary-side");
  var formErrorEl = document.getElementById("form-error");

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var fulfillment = readSavedFulfillment();
      if (!validateForm(form, fulfillment)) return;

      verifyBtn.classList.add("is-loading");
      verifyBtn.disabled = true;

      submitOrder(fulfillment)
        .then(function (order) {
          var orderCodeEl = document.getElementById("order-code-value");
          if (orderCodeEl) orderCodeEl.textContent = order.orderCode;

          var proofBadge = document.getElementById("confirmation-proof");
          if (proofBadge) proofBadge.style.display = paymentProofDataUrl ? "inline-flex" : "none";

          if (checkoutPanel) checkoutPanel.style.display = "none";
          if (confirmationPanel) confirmationPanel.classList.add("is-visible");
          if (summarySide) summarySide.style.display = "none";
          if (layout) layout.classList.add("is-empty");

          SuccessCafeCart.saveCart([]);
          if (SuccessCafeCart.clearFulfillment) {
            SuccessCafeCart.clearFulfillment();
          } else {
            try { localStorage.removeItem("successCafeFulfillment"); } catch (e) { /* ignore */ }
          }
          SuccessCafeCart.updateCartBadge();
          clearPaymentProof();
        })
        .catch(function (err) {
          if (formErrorEl) {
            formErrorEl.textContent = err.message || formErrorEl.dataset.defaultText;
            formErrorEl.classList.add("is-visible");
          }
        })
        .then(function () {
          verifyBtn.classList.remove("is-loading");
          verifyBtn.disabled = false;
        });
    });
  }
});
