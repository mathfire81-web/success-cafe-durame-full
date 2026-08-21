/*
  HELP MODAL CONTROLLER
  The "?" helper button (and any ".js-help-trigger") opens a floating
  panel explaining how to order for delivery vs. in the cafe, instead
  of scrolling to the footer.
*/

document.addEventListener("DOMContentLoaded", function () {
  var overlay = document.getElementById("help-modal-overlay");
  if (!overlay) return;

  var closeBtn = document.getElementById("help-modal-close");

  function closeOtherOverlays() {
    var deliveryOverlay = document.getElementById("delivery-modal-overlay");
    if (deliveryOverlay && deliveryOverlay.classList.contains("is-open")) {
      deliveryOverlay.classList.remove("is-open");
      document.body.classList.remove("delivery-modal-open");
    }
    var cartOverlay = document.getElementById("cart-drawer-overlay");
    if (cartOverlay && cartOverlay.classList.contains("is-open")) {
      cartOverlay.classList.remove("is-open");
      document.body.classList.remove("cart-drawer-open");
    }
  }

  function openModal() {
    closeOtherOverlays();
    overlay.classList.add("is-open");
    document.body.classList.add("help-modal-open");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    overlay.classList.remove("is-open");
    document.body.classList.remove("help-modal-open");
    if (window.location.hash === "#help") {
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

  /* Every helper button / link site-wide that points at Help opens the
     floating panel instead of scrolling or navigating anywhere. */
  document.querySelectorAll(".js-help-trigger").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      openModal();
    });
  });

  /* The footer CTAs inside the panel (Browse Menu / View Cart) should
     close this panel once they act, so it doesn't linger behind. */
  var menuLink = overlay.querySelector(".js-help-menu-link");
  if (menuLink) menuLink.addEventListener("click", closeModal);

  /* Deep-linkable: visiting any page at #help opens the panel
     automatically, matching the existing #delivery / #cart pattern. */
  if (window.location.hash === "#help") openModal();
});
