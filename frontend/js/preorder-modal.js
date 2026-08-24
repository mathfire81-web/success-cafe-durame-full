/*
  PRE ORDER FOOD MODAL CONTROLLER
  Opened by any ".js-preorder-trigger" (hero CTA + header nav button).
  Lets someone reserve a table and build a food order ahead of time.
  This is a separate flow from the shopping cart - quantities picked
  here live in their own local state (poQty) and are NOT added to
  SuccessCafeCart, since a pre-order is "have this ready for my table"
  rather than a delivery/pickup checkout. It's also free/unpaid - a
  reservation, not a purchase. On submit this POSTs to /api/preorders
  (see js/api-config.js for API_BASE_URL), same fetch pattern as
  js/payment.js and js/idea-modal.js, and only shows the confirmation
  once the server confirms it saved.
*/

var poQty = {};

function poFormatPrice(value) {
  return value.toFixed(0) + " ETB";
}

/* ---- Optional payment-screenshot upload (same pattern as
   js/payment.js's proof upload - a pre-order has no required payment,
   but someone who already sent a deposit can attach the receipt). ---- */
var poProofFile = null;
var PO_MAX_PROOF_SIZE = 8 * 1024 * 1024; // 8MB

function poFormatFileSize(bytes) {
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function poShowProofError(message) {
  var uploadField = document.getElementById("preorder-upload-field");
  var dropzone = document.getElementById("preorder-upload-dropzone");
  if (uploadField) uploadField.classList.add("has-error");
  var subEl = dropzone ? dropzone.querySelector(".upload-dropzone-sub") : null;
  if (subEl) subEl.textContent = message;
}

function poClearProofError() {
  var uploadField = document.getElementById("preorder-upload-field");
  var dropzone = document.getElementById("preorder-upload-dropzone");
  if (uploadField) uploadField.classList.remove("has-error");
  var subEl = dropzone ? dropzone.querySelector(".upload-dropzone-sub") : null;
  if (subEl) subEl.textContent = "Screenshot or photo of your receipt \u00b7 JPG or PNG, up to 8MB";
}

function poSetProof(file) {
  if (!file) return;

  if (file.type.indexOf("image/") !== 0) {
    poShowProofError("Please upload an image file (JPG or PNG).");
    return;
  }
  if (file.size > PO_MAX_PROOF_SIZE) {
    poShowProofError("That image is too large - please keep it under 8MB.");
    return;
  }

  poClearProofError();
  poProofFile = file;

  var reader = new FileReader();
  reader.onload = function (event) {
    var previewImg = document.getElementById("preorder-upload-preview-img");
    var previewBox = document.getElementById("preorder-upload-preview");
    var fileNameEl = document.getElementById("preorder-upload-file-name");
    var dropzone = document.getElementById("preorder-upload-dropzone");

    if (previewImg) previewImg.src = event.target.result;
    if (fileNameEl) fileNameEl.textContent = file.name + " \u00b7 " + poFormatFileSize(file.size);
    if (previewBox) previewBox.classList.add("is-visible");
    if (dropzone) dropzone.style.display = "none";
  };
  reader.readAsDataURL(file);
}

function poClearProof() {
  poProofFile = null;

  var fileInput = document.getElementById("preorder-field-proof");
  var previewBox = document.getElementById("preorder-upload-preview");
  var dropzone = document.getElementById("preorder-upload-dropzone");

  if (fileInput) fileInput.value = "";
  if (previewBox) previewBox.classList.remove("is-visible");
  if (dropzone) dropzone.style.display = "";
  poClearProofError();
}

function poWireProofUpload() {
  var dropzone = document.getElementById("preorder-upload-dropzone");
  var fileInput = document.getElementById("preorder-field-proof");
  var removeBtn = document.getElementById("preorder-upload-remove");

  if (fileInput) {
    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) poSetProof(fileInput.files[0]);
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
      if (file) poSetProof(file);
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      poClearProof();
    });
  }
}

function poGetTotals() {
  var count = 0;
  var total = 0;
  if (typeof MENU_DATA === "undefined") return { count: count, total: total };
  MENU_DATA.categories.forEach(function (category) {
    category.items.forEach(function (item) {
      var qty = poQty[item.id] || 0;
      count += qty;
      total += qty * item.price;
    });
  });
  return { count: count, total: total };
}

function poBuildItemRow(item, qty) {
  return (
    '<div class="fp-item" data-item-id="' + item.id + '">' +
      '<div class="fp-item-info">' +
        '<h4>' + item.name + (item.nameAm ? ' <span class="fp-item-name-am">' + item.nameAm + '</span>' : '') + '</h4>' +
        '<span class="fp-item-price">' + poFormatPrice(item.price) + '</span>' +
      '</div>' +
      '<div class="fp-stepper">' +
        '<button type="button" class="fp-stepper-btn po-minus" data-item-id="' + item.id + '" aria-label="Decrease ' + item.name + ' quantity">&minus;</button>' +
        '<span class="fp-stepper-value" data-item-id="' + item.id + '">' + qty + '</span>' +
        '<button type="button" class="fp-stepper-btn po-plus" data-item-id="' + item.id + '" aria-label="Increase ' + item.name + ' quantity">+</button>' +
      '</div>' +
    '</div>'
  );
}

function poBuildCategoryBlock(category) {
  var itemsHtml = category.items.map(function (item) {
    return poBuildItemRow(item, poQty[item.id] || 0);
  }).join("");

  return (
    '<div class="fp-category">' +
      '<h3 class="fp-category-name">' + category.name + (category.nameAm ? ' <span class="fp-category-name-am">' + category.nameAm + '</span>' : '') + '</h3>' +
      itemsHtml +
    '</div>'
  );
}

function poRenderList() {
  var list = document.getElementById("preorder-food-list");
  if (!list || typeof MENU_DATA === "undefined") return;
  list.innerHTML = MENU_DATA.categories.map(poBuildCategoryBlock).join("");
}

function poUpdateSummaryBar() {
  var bar = document.getElementById("preorder-summary-bar");
  if (!bar) return;
  var totals = poGetTotals();
  if (totals.count === 0) {
    bar.classList.remove("is-visible");
    return;
  }
  bar.classList.add("is-visible");
  bar.innerHTML =
    '<span>' + totals.count + (totals.count === 1 ? ' item selected' : ' items selected') + '</span>' +
    '<strong>' + poFormatPrice(totals.total) + '</strong>';
}

document.addEventListener("DOMContentLoaded", function () {
  var overlay = document.getElementById("preorder-modal-overlay");
  if (!overlay) return;

  var closeBtn = document.getElementById("preorder-modal-close");
  var form = document.getElementById("preorder-form");
  var successPanel = document.getElementById("preorder-form-success");
  var foodList = document.getElementById("preorder-food-list");
  var firstField = document.getElementById("preorder-name");

  function closeOtherOverlays() {
    ["delivery-modal-overlay", "help-modal-overlay", "idea-modal-overlay", "cart-drawer-overlay"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.classList.contains("is-open")) {
        el.classList.remove("is-open");
        document.body.classList.remove(id.replace("-overlay", "-open").replace("cart-drawer-open", "cart-drawer-open"));
      }
    });
    /* Body-class names don't all follow the same pattern as the ids
       above, so clear the known ones explicitly too - harmless if
       they were never set. */
    document.body.classList.remove("delivery-modal-open", "help-modal-open", "idea-modal-open", "cart-drawer-open");
  }

  function resetToForm() {
    poQty = {};
    if (form) {
      form.reset();
      form.style.display = "";
    }
    if (successPanel) successPanel.classList.remove("is-visible");
    var errorEl = document.getElementById("preorder-form-error");
    if (errorEl) errorEl.style.display = "none";
    var submitBtn = document.getElementById("preorder-form-submit-btn");
    if (submitBtn) submitBtn.disabled = false;
    poClearProof();
    poRenderList();
    poUpdateSummaryBar();
  }

  poWireProofUpload();

  function openModal() {
    closeOtherOverlays();
    resetToForm();
    overlay.classList.add("is-open");
    document.body.classList.add("preorder-modal-open");
    if (firstField) firstField.focus();
  }

  function closeModal() {
    overlay.classList.remove("is-open");
    document.body.classList.remove("preorder-modal-open");
    if (window.location.hash === "#preorder") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) closeModal();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && overlay.classList.contains("is-open")) closeModal();
  });

  /* Every pre-order trigger site-wide opens this floating panel. */
  document.querySelectorAll(".js-preorder-trigger").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      openModal();
    });
  });

  /* Quantity steppers for the embedded food list. */
  if (foodList) {
    foodList.addEventListener("click", function (event) {
      var minusBtn = event.target.closest(".po-minus");
      var plusBtn = event.target.closest(".po-plus");
      if (!minusBtn && !plusBtn) return;

      var id = (minusBtn || plusBtn).getAttribute("data-item-id");
      var currentQty = poQty[id] || 0;

      if (plusBtn) {
        poQty[id] = currentQty + 1;
      } else if (minusBtn && currentQty > 0) {
        poQty[id] = currentQty - 1;
      }

      var valueEls = foodList.querySelectorAll('.fp-stepper-value[data-item-id="' + id + '"]');
      valueEls.forEach(function (el) { el.textContent = poQty[id]; });
      poUpdateSummaryBar();
    });
  }

  var submitBtn = document.getElementById("preorder-form-submit-btn");
  var submitLabel = submitBtn ? submitBtn.querySelector(".preorder-form-submit-label") : null;

  function showPreorderError(message) {
    var errorEl = document.getElementById("preorder-form-error");
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.style.display = "";
  }

  function clearPreorderError() {
    var errorEl = document.getElementById("preorder-form-error");
    if (errorEl) errorEl.style.display = "none";
  }

  function poBuildItemsPayload() {
    var items = [];
    Object.keys(poQty).forEach(function (id) {
      if (poQty[id] > 0) items.push({ id: id, qty: poQty[id] });
    });
    return items;
  }

  function submitPreorder(name, phone, date, time, guests, notes) {
    /* FormData (not JSON) so the optional payment-screenshot file can
       ride along in the same request - same pattern as js/payment.js's
       submitOrder. The server still parses "items" as JSON text. */
    var formData = new FormData();
    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("date", date);
    formData.append("time", time);
    formData.append("guests", guests);
    formData.append("notes", notes);
    formData.append("items", JSON.stringify(poBuildItemsPayload()));
    if (poProofFile) formData.append("proof", poProofFile);

    return fetch((window.API_BASE_URL || "") + "/api/preorders", {
      method: "POST",
      body: formData
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || "Something went wrong sending your reservation.");
        return data;
      });
    });
  }

  /* Validates locally first (same as before), then sends the
     reservation + any food picked to the server and only shows the
     confirmation once it's actually saved. */
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var name = document.getElementById("preorder-name").value.trim();
      var phone = document.getElementById("preorder-phone").value.trim();
      var date = document.getElementById("preorder-date").value;
      var time = document.getElementById("preorder-time").value;
      var guests = document.getElementById("preorder-guests").value;
      var notesField = document.getElementById("preorder-notes");
      var notes = notesField ? notesField.value.trim() : "";
      var totals = poGetTotals();

      clearPreorderError();
      if (submitBtn) submitBtn.disabled = true;
      if (submitLabel) submitLabel.textContent = "Sending...";

      submitPreorder(name, phone, date, time, guests, notes)
        .then(function (result) {
          var details = document.getElementById("preorder-form-success-details");
          if (details) {
            details.innerHTML =
              '<span><strong>Reservation code:</strong> ' + result.preorderCode + '</span>' +
              '<span><strong>Table for:</strong> ' + guests + '</span>' +
              '<span><strong>Date &amp; time:</strong> ' + date + (time ? " at " + time : "") + '</span>' +
              '<span><strong>Food ready for you:</strong> ' + (totals.count > 0 ? totals.count + " item(s), " + poFormatPrice(totals.total) : "Decide when you arrive") + '</span>' +
              (poProofFile ? '<span><strong>Payment screenshot:</strong> Received</span>' : '');
          }
          var successName = document.getElementById("preorder-success-name");
          if (successName) successName.textContent = name ? name + ", " : "";

          form.style.display = "none";
          if (successPanel) successPanel.classList.add("is-visible");
          poClearProof();
        })
        .catch(function (err) {
          showPreorderError(err.message || "Something went wrong sending your reservation. Please try again.");
        })
        .then(function () {
          if (submitBtn) submitBtn.disabled = false;
          if (submitLabel) submitLabel.textContent = "Confirm (ያረጋግጡ)";
        });
    });
  }

  var successCloseBtn = overlay.querySelector(".js-preorder-close");
  if (successCloseBtn) successCloseBtn.addEventListener("click", closeModal);

  /* Deep-linkable: visiting the page at #preorder opens the panel
     automatically, matching the existing #help / #delivery / #share-idea pattern. */
  if (window.location.hash === "#preorder") openModal();
});
