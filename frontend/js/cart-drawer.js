/*
  CART DRAWER CONTROLLER
  Every cart icon/link site-wide (".js-cart-trigger") opens a floating
  panel that slides in from the right, instead of navigating to a
  separate cart page. Renders the saved cart (via SuccessCafeCart, see
  cart.js), keeps the total in sync, and sends the shopper to
  payment-verification.html once they hit "Checkout".
*/

function formatMoney(value) {
  return value.toFixed(0) + " ETB";
}

function findCartItem(cart, id) {
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id === id) return cart[i];
  }
  return null;
}

/* ---- Fulfillment badge (shows the cart differently depending on
   whether it was built from the delivery panel or picked directly off
   the menu) ----
   - "delivery": items were added through the delivery modal's food
     picker (js/food-picker.js) and/or a landmark was selected on the
     delivery map (js/delivery-map.js). Shows the delivery fee here in
     the drawer already, and rolls it into the drawer's own total, so
     there's no surprise once they reach payment-verification.html.
   - "in-cafe": items were added straight from a menu grid (menu.js /
     home.js). No fee, plain subtotal-only total. */
function buildFulfillmentBadge(fulfillment) {
  var isDelivery = fulfillment.method === "delivery";

  if (isDelivery) {
    var fee = fulfillment.fee || 50;
    return (
      '<div class="cart-drawer-fulfillment-badge is-delivery">' +
        '<svg class="icon" aria-hidden="true"><use href="#icon-truck"></use></svg>' +
        '<span>Delivery order &middot; ' + formatMoney(fee) + ' fee</span>' +
      "</div>"
    );
  }

  return (
    '<div class="cart-drawer-fulfillment-badge is-in-cafe">' +
      '<svg class="icon" aria-hidden="true"><use href="#icon-bag"></use></svg>' +
      "<span>In Cafe order &middot; no delivery fee</span>" +
      '<button type="button" class="cart-drawer-switch-delivery">Ordering for delivery instead?</button>' +
    "</div>"
  );
}

function buildCartItemRow(item) {
  return (
    '<li class="cart-item" data-item-id="' + item.id + '">' +
      '<div class="cart-item-media"><img src="' + item.image + '" alt="' + item.name + '" loading="lazy"></div>' +
      '<div class="cart-item-info">' +
        "<h3>" + item.name + "</h3>" +
        '<p class="cart-item-unit-price">' + formatMoney(item.price) + "</p>" +
        '<div class="cart-item-controls">' +
          '<div class="qty-stepper">' +
            '<button type="button" class="qty-btn qty-minus" data-item-id="' + item.id + '" aria-label="Decrease quantity">&minus;</button>' +
            '<span class="qty-value">' + item.qty + "</span>" +
            '<button type="button" class="qty-btn qty-plus" data-item-id="' + item.id + '" aria-label="Increase quantity">+</button>' +
          "</div>" +
          '<button type="button" class="cart-item-remove" data-item-id="' + item.id + '" aria-label="Remove ' + item.name + '">' +
            '<svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg>' +
          '</button>' +
        "</div>" +
      "</div>" +
    "</li>"
  );
}

function renderCartDrawer() {
  if (typeof SuccessCafeCart === "undefined") return;

  var cart = SuccessCafeCart.getCart();
  var list = document.getElementById("cart-items-list");
  var empty = document.getElementById("cart-empty");
  var footBlock = document.getElementById("cart-drawer-foot");
  var checkoutBtn = document.getElementById("checkout-btn");
  if (!list || !empty) return;

  if (cart.length === 0) {
    list.innerHTML = "";
    list.classList.add("is-hidden");
    empty.classList.add("is-visible");
    if (footBlock) footBlock.classList.add("is-hidden");
  } else {
    list.innerHTML = cart.map(buildCartItemRow).join("");
    list.classList.remove("is-hidden");
    empty.classList.remove("is-visible");
    if (footBlock) footBlock.classList.remove("is-hidden");
  }

  var fulfillment = SuccessCafeCart.getFulfillment();
  var isDelivery = fulfillment.method === "delivery";
  var subtotal = SuccessCafeCart.getTotal();
  var deliveryFee = isDelivery ? (fulfillment.fee || 50) : 0;

  var fulfillmentEl = document.getElementById("cart-drawer-fulfillment");
  if (fulfillmentEl) {
    fulfillmentEl.innerHTML = cart.length ? buildFulfillmentBadge(fulfillment) : "";
  }

  var totalEl = document.getElementById("cart-drawer-total");
  if (totalEl) totalEl.textContent = formatMoney(subtotal + deliveryFee);

  if (checkoutBtn) {
    if (cart.length === 0) checkoutBtn.setAttribute("aria-disabled", "true");
    else checkoutBtn.removeAttribute("aria-disabled");
  }

  SuccessCafeCart.updateCartBadge();
}

document.addEventListener("DOMContentLoaded", function () {
  var overlay = document.getElementById("cart-drawer-overlay");
  if (!overlay) return;

  var closeBtn = document.getElementById("cart-drawer-close");

  function openDrawer() {
    var deliveryOverlay = document.getElementById("delivery-modal-overlay");
    if (deliveryOverlay && deliveryOverlay.classList.contains("is-open")) {
      deliveryOverlay.classList.remove("is-open");
      document.body.classList.remove("delivery-modal-open");
    }
    var helpOverlay = document.getElementById("help-modal-overlay");
    if (helpOverlay && helpOverlay.classList.contains("is-open")) {
      helpOverlay.classList.remove("is-open");
      document.body.classList.remove("help-modal-open");
    }
    renderCartDrawer();
    overlay.classList.add("is-open");
    document.body.classList.add("cart-drawer-open");
    if (closeBtn) closeBtn.focus();
  }

  function closeDrawer() {
    overlay.classList.remove("is-open");
    document.body.classList.remove("cart-drawer-open");
    if (window.location.hash === "#cart") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) closeDrawer();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && overlay.classList.contains("is-open")) closeDrawer();
  });

  /* Every link/icon site-wide that points at the cart opens the
     floating drawer instead of navigating anywhere. */
  document.querySelectorAll(".js-cart-trigger").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      openDrawer();
    });
  });

  var list = document.getElementById("cart-items-list");
  if (list) {
    list.addEventListener("click", function (event) {
      var minusBtn = event.target.closest(".qty-minus");
      var plusBtn = event.target.closest(".qty-plus");
      var removeBtn = event.target.closest(".cart-item-remove");
      if (!minusBtn && !plusBtn && !removeBtn) return;

      var id = (minusBtn || plusBtn || removeBtn).getAttribute("data-item-id");

      if (removeBtn) {
        SuccessCafeCart.removeItem(id);
      } else {
        var item = findCartItem(SuccessCafeCart.getCart(), id);
        if (!item) return;
        var nextQty = minusBtn ? item.qty - 1 : item.qty + 1;
        SuccessCafeCart.setQty(id, nextQty);
      }
      renderCartDrawer();
    });
  }

  var checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", function (event) {
      if (typeof SuccessCafeCart === "undefined" || SuccessCafeCart.getCart().length === 0) {
        event.preventDefault();
        return;
      }
      /* This is the plain "Checkout" button (menu/cart drawer), so this
         is always an in-cafe order - always tag it as such. Genuine
         delivery orders are tagged separately, right before navigating,
         by the delivery panel's own Checkout button (dm-checkout-btn,
         see js/delivery-map.js). Without this unconditional reset, a
         stale "delivery" tag left over from merely browsing the
         delivery panel's quantity steppers would stick around and
         mislabel every later in-cafe order too. */
      SuccessCafeCart.setFulfillment("in-cafe", 0);
    });
  }

  /* "Ordering for delivery instead?" link inside the in-cafe badge -
     closes the cart and opens the delivery panel on top of it,
     mirroring what js/delivery-modal.js does for every other
     ".js-delivery-trigger", but bound with delegation since this
     button is rendered dynamically inside renderCartDrawer(). */
  var body = document.querySelector(".cart-drawer-body") || document;
  var footEl = document.getElementById("cart-drawer-foot");
  [body, footEl].forEach(function (scope) {
    if (!scope) return;
    scope.addEventListener("click", function (event) {
      if (!event.target.closest(".cart-drawer-switch-delivery")) return;
      var deliveryOverlay = document.getElementById("delivery-modal-overlay");
      closeDrawer();
      if (deliveryOverlay) {
        deliveryOverlay.classList.add("is-open");
        document.body.classList.add("delivery-modal-open");
      }
    });
  });

  /* Deep-linkable: visiting any page at #cart opens the drawer
     automatically, matching the existing #delivery pattern. */
  if (window.location.hash === "#cart") openDrawer();

  /* Keep the header/mobile badge counts correct even before the
     drawer has been opened. */
  renderCartDrawer();
});
