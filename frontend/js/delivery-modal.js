/*
  DELIVERY MODAL CONTROLLER
  The "Delivery" nav link/tab opens a floating panel on top of whatever
  page the person is already on - there is no separate delivery page.
*/

document.addEventListener("DOMContentLoaded", function () {
  var overlay = document.getElementById("delivery-modal-overlay");
  if (!overlay) return;

  var closeBtn = document.getElementById("delivery-modal-close");

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

  function closeModal() {
    overlay.classList.remove("is-open");
    document.body.classList.remove("delivery-modal-open");
    if (window.location.hash === "#delivery") {
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
