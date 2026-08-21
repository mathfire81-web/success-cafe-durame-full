/*
  PRE ORDER FOOD MODAL CONTROLLER
  Opened by any ".js-preorder-trigger" (hero CTA + header nav button).
  Lets someone reserve a table and build a food order ahead of time.
  This is a separate flow from the shopping cart - quantities picked
  here live in their own local state (poQty) and are NOT added to
  SuccessCafeCart, since a pre-order is "have this ready for my table"
  rather than a delivery/pickup checkout. Front-end only for now: on
  submit it validates the fields and swaps in a confirmation, the same
  pattern used by js/idea-modal.js.
*/

var poQty = {};

function poFormatPrice(value) {
  return value.toFixed(0) + " ETB";
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
    poRenderList();
    poUpdateSummaryBar();
  }

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

  /* Front-end only for now: no backend to send this to yet, so
     confirming just validates the fields and swaps in a reservation
     confirmation with what was entered. */
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var name = document.getElementById("preorder-name").value.trim();
      var date = document.getElementById("preorder-date").value;
      var time = document.getElementById("preorder-time").value;
      var guests = document.getElementById("preorder-guests").value;
      var totals = poGetTotals();

      var details = document.getElementById("preorder-form-success-details");
      if (details) {
        details.innerHTML =
          '<span><strong>Table for:</strong> ' + guests + '</span>' +
          '<span><strong>Date &amp; time:</strong> ' + date + (time ? " at " + time : "") + '</span>' +
          '<span><strong>Food ready for you:</strong> ' + (totals.count > 0 ? totals.count + " item(s), " + poFormatPrice(totals.total) : "Decide when you arrive") + '</span>';
      }
      var successName = document.getElementById("preorder-success-name");
      if (successName) successName.textContent = name ? name + ", " : "";

      form.style.display = "none";
      if (successPanel) successPanel.classList.add("is-visible");
    });
  }

  var successCloseBtn = overlay.querySelector(".js-preorder-close");
  if (successCloseBtn) successCloseBtn.addEventListener("click", closeModal);

  /* Deep-linkable: visiting the page at #preorder opens the panel
     automatically, matching the existing #help / #delivery / #share-idea pattern. */
  if (window.location.hash === "#preorder") openModal();
});
