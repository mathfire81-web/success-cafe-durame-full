/*
  CART JS
  Shared cart utility - used by menu.js (add to cart) and, later,
  the cart drawer and payment-verification.html for checkout.
  Cart is stored in localStorage under "successCafeCart" as an array
  of { id, name, price, image, qty }.
*/

var SuccessCafeCart = (function () {
  var STORAGE_KEY = "successCafeCart";
  var FULFILLMENT_KEY = "successCafeFulfillment";

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateCartBadge();
  }

  function addItem(item) {
    var cart = getCart();
    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === item.id) { existing = cart[i]; break; }
    }
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        qty: 1
      });
    }
    saveCart(cart);
    return cart;
  }

  function removeItem(id) {
    var cart = getCart().filter(function (item) { return item.id !== id; });
    saveCart(cart);
    return cart;
  }

  function setQty(id, qty) {
    var cart = getCart();
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) {
        cart[i].qty = Math.max(0, qty);
      }
    }
    cart = cart.filter(function (item) { return item.qty > 0; });
    saveCart(cart);
    return cart;
  }

  function getCount() {
    return getCart().reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function getTotal() {
    return getCart().reduce(function (sum, item) { return sum + item.qty * item.price; }, 0);
  }

  /* ---- Fulfillment (how this order was placed) ----
     Read by payment-verification.html to label the order "Delivery" or
     "In Cafe" and, for delivery, add the fee. Set right before leaving
     for checkout: the delivery panel's Checkout button marks it
     "delivery" (with whatever fee the map/landmark picker last showed),
     the cart drawer's Checkout button (used from the menu page) marks
     it "in-cafe".

     `details` (delivery only) carries whatever the landmark picker in
     js/delivery-map.js knows about the drop-off point - name, distance,
     ETA - so payment-verification.html can show a confirmed delivery
     address card instead of asking the shopper to type one in again. */
  function setFulfillment(method, fee, details) {
    try {
      var payload = { method: method, fee: fee || 0 };
      if (method === "delivery" && details) payload.details = details;
      localStorage.setItem(FULFILLMENT_KEY, JSON.stringify(payload));
    } catch (e) { /* ignore */ }
  }

  function getFulfillment() {
    try {
      var saved = JSON.parse(localStorage.getItem(FULFILLMENT_KEY));
      if (saved && saved.method) return saved;
    } catch (e) { /* ignore */ }
    return { method: "in-cafe", fee: 0 };
  }

  function clearFulfillment() {
    try { localStorage.removeItem(FULFILLMENT_KEY); } catch (e) { /* ignore */ }
  }

  function updateCartBadge() {
    var els = document.querySelectorAll(".cart-count");
    if (els.length) {
      var count = getCount();
      els.forEach(function (el) { el.textContent = count; });
    }
  }

  /* ---- "Fly to cart" animation ----
     Sends a small clone of the item's image flying from wherever it
     was added (a menu card, the home page grid, etc.) over to
     whichever cart icon is currently visible (header icon on desktop,
     bottom tab icon on mobile), then gives that icon + its count
     badge a little "landed" bump. Purely visual - addItem/saveCart
     above are what actually update the cart. */

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function getCartIconTarget() {
    var selectors = [".cart-link", ".mobile-tab-cart"];
    for (var s = 0; s < selectors.length; s++) {
      var els = document.querySelectorAll(selectors[s]);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && el.offsetParent !== null) {
          return el;
        }
      }
    }
    return null;
  }

  function bumpCartIcon(target) {
    if (!target) return;
    var iconWrap = target.querySelector(".mobile-tab-cart-icon") || target;

    iconWrap.classList.remove("cart-icon-bump");
    void iconWrap.offsetWidth; /* force reflow so the animation restarts */
    iconWrap.classList.add("cart-icon-bump");

    var badge = target.querySelector(".cart-count");
    if (badge) {
      badge.classList.remove("cart-count-bump");
      void badge.offsetWidth;
      badge.classList.add("cart-count-bump");
    }

    setTimeout(function () {
      iconWrap.classList.remove("cart-icon-bump");
      if (badge) badge.classList.remove("cart-count-bump");
    }, 500);
  }

  function flyToCart(originEl, imageUrl) {
    var target = getCartIconTarget();

    if (!target || !originEl || typeof originEl.getBoundingClientRect !== "function" || prefersReducedMotion()) {
      bumpCartIcon(target);
      return;
    }

    var startRect = originEl.getBoundingClientRect();
    if (!startRect.width || !startRect.height) {
      bumpCartIcon(target);
      return;
    }
    var endRect = target.getBoundingClientRect();

    var size = Math.max(28, Math.min(startRect.width, startRect.height, 60));
    var ghost = document.createElement("div");
    ghost.className = "cart-fly-ghost" + (imageUrl ? "" : " cart-fly-ghost-plain");
    ghost.style.width = size + "px";
    ghost.style.height = size + "px";
    ghost.style.left = (startRect.left + startRect.width / 2 - size / 2) + "px";
    ghost.style.top = (startRect.top + startRect.height / 2 - size / 2) + "px";
    if (imageUrl) {
      ghost.style.backgroundImage = "url('" + imageUrl + "')";
    }
    document.body.appendChild(ghost);

    var startX = startRect.left + startRect.width / 2;
    var startY = startRect.top + startRect.height / 2;
    var endX = endRect.left + endRect.width / 2;
    var endY = endRect.top + endRect.height / 2;
    var deltaX = endX - startX;
    var deltaY = endY - startY;

    /* Curve the path upward through the midpoint so it arcs into the
       cart instead of sliding there in a flat line. */
    var midX = deltaX * 0.5;
    var midY = deltaY * 0.5 - Math.max(70, Math.abs(deltaX) * 0.3);

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      ghost.remove();
      bumpCartIcon(target);
    }

    if (typeof ghost.animate === "function") {
      var animation = ghost.animate(
        [
          { transform: "translate(0px, 0px) scale(1)", opacity: 1, offset: 0 },
          { transform: "translate(" + midX + "px, " + midY + "px) scale(0.72)", opacity: 1, offset: 0.55 },
          { transform: "translate(" + deltaX + "px, " + deltaY + "px) scale(0.15)", opacity: 0.5, offset: 1 }
        ],
        { duration: 650, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" }
      );
      animation.onfinish = finish;
      animation.oncancel = finish;
    } else {
      /* Very old browsers without the Web Animations API: just show
         the badge bump without the flight. */
      setTimeout(finish, 0);
    }
  }

  return {
    getCart: getCart,
    saveCart: saveCart,
    addItem: addItem,
    removeItem: removeItem,
    setQty: setQty,
    getCount: getCount,
    getTotal: getTotal,
    updateCartBadge: updateCartBadge,
    flyToCart: flyToCart,
    setFulfillment: setFulfillment,
    getFulfillment: getFulfillment,
    clearFulfillment: clearFulfillment
  };
})();
