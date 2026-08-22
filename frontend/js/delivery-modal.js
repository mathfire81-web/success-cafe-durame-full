/*
  DELIVERY MODAL CONTROLLER
  The "Delivery" nav link/tab opens a floating panel on top of whatever
  page the person is already on - there is no separate delivery page.
*/

document.addEventListener("DOMContentLoaded", function () {
  var overlay = document.getElementById("delivery-modal-overlay");
  if (!overlay) return;

  var closeBtn = document.getElementById("delivery-modal-close");
  var confirmBox = document.getElementById("dm-close-confirm");
  var confirmBack = document.getElementById("dm-close-confirm-back");
  var confirmLeave = document.getElementById("dm-close-confirm-leave");
  var confirmCount = document.getElementById("dm-close-confirm-count");

  function openModal() {
    var cartOverlay = document.getElementById("cart-drawer-overlay");
    if (cartOverlay && cartOverlay.classList.contains("is-open")) {
      cartOverlay.classList.remove("is-open");
      document.body.classList.remove("cart-drawer-open");
    }
    var helpOverlay = document.getElementById("help-modal-overlay");
    if (helpOverlay && helpOverlay.classList.contains("is-open")) {
      helpOverlay.classList.remove("is-open");
      document.body.classList.remove("help-modal-open");
    }
    overlay.classList.add("is-open");
    document.body.classList.add("delivery-modal-open");
    if (closeBtn) closeBtn.focus();
  }

  /* Actually closes the panel (bypasses the "are you sure?" guard). */
  function closeModal() {
    hideCloseConfirm();
    overlay.classList.remove("is-open");
    document.body.classList.remove("delivery-modal-open");
    if (window.location.hash === "#delivery") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  /* "I'm sure" - the person confirmed they want to abandon the food they
     picked, so clear it from the cart along with the panel. */
  function closeModalAndClearCart() {
    if (typeof SuccessCafeCart !== "undefined") {
      try { SuccessCafeCart.clearCart(); } catch (e) { /* ignore */ }
    }
    closeModal();
  }

  /* Whether the person has picked any food yet - if so, closing the panel
     is very likely accidental, since delivery can only be ordered from
     here. */
  function hasChosenFood() {
    if (typeof SuccessCafeCart === "undefined") return false;
    try {
      var cart = SuccessCafeCart.getCart();
      return !!cart && cart.length > 0;
    } catch (e) {
      return false;
    }
  }

  function showCloseConfirm() {
    if (!confirmBox) { closeModal(); return; }
    if (confirmCount && typeof SuccessCafeCart !== "undefined") {
      try {
        var count = SuccessCafeCart.getCount();
        confirmCount.textContent = count + (count === 1 ? " item" : " items");
      } catch (e) { /* leave default label */ }
    }
    confirmBox.classList.add("is-open");
    if (confirmLeave) confirmLeave.focus();
  }

  function hideCloseConfirm() {
    if (confirmBox) confirmBox.classList.remove("is-open");
  }

  /* Entry point for every "close" trigger (✕ button, backdrop click,
     Escape). Only interrupts with the confirmation if food has actually
     been chosen - otherwise it closes right away. */
  function requestClose() {
    if (confirmBox && confirmBox.classList.contains("is-open")) return;
    if (hasChosenFood()) {
      showCloseConfirm();
    } else {
      closeModal();
    }
  }

  if (closeBtn) closeBtn.addEventListener("click", requestClose);

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) requestClose();
  });

  if (confirmBack) confirmBack.addEventListener("click", hideCloseConfirm);
  if (confirmLeave) confirmLeave.addEventListener("click", closeModalAndClearCart);

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (confirmBox && confirmBox.classList.contains("is-open")) {
      hideCloseConfirm();
    } else if (overlay.classList.contains("is-open")) {
      requestClose();
    }
  });

  /* Every link/tab site-wide that points at "Delivery" opens the
     floating panel instead of navigating anywhere. */
  document.querySelectorAll(".js-delivery-trigger").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      openModal();
    });
  });

  /* Deep-linkable: visiting any page at #delivery opens the panel
     automatically. */
  if (window.location.hash === "#delivery") openModal();
});
