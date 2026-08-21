/*
  SHARE AN IDEA MODAL CONTROLLER
  The "Share an Idea" fab (and any ".js-idea-trigger") opens a floating
  panel with a short form: name, email, category, and a free-text idea.
  Front-end only for now - on submit it just swaps to a thank-you state,
  there's no backend wired up yet.
*/

document.addEventListener("DOMContentLoaded", function () {
  var overlay = document.getElementById("idea-modal-overlay");
  if (!overlay) return;

  var closeBtn = document.getElementById("idea-modal-close");
  var form = document.getElementById("idea-form");
  var successPanel = document.getElementById("idea-form-success");
  var firstField = document.getElementById("idea-name");

  function closeOtherOverlays() {
    var helpOverlay = document.getElementById("help-modal-overlay");
    if (helpOverlay && helpOverlay.classList.contains("is-open")) {
      helpOverlay.classList.remove("is-open");
      document.body.classList.remove("help-modal-open");
    }
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

  function resetToForm() {
    if (form) {
      form.reset();
      form.style.display = "";
    }
    if (successPanel) successPanel.classList.remove("is-visible");
  }

  function openModal() {
    closeOtherOverlays();
    resetToForm();
    overlay.classList.add("is-open");
    document.body.classList.add("idea-modal-open");
    if (firstField) firstField.focus();
  }

  function closeModal() {
    overlay.classList.remove("is-open");
    document.body.classList.remove("idea-modal-open");
    if (window.location.hash === "#share-idea") {
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

  /* Every idea-sharing trigger site-wide opens this floating panel. */
  document.querySelectorAll(".js-idea-trigger").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      openModal();
    });
  });

  /* Front-end only for now: no backend to send this to yet, so submitting
     just validates the fields and swaps in a thank-you confirmation. */
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      form.style.display = "none";
      if (successPanel) successPanel.classList.add("is-visible");
    });
  }

  var successCloseBtn = overlay.querySelector(".js-idea-close");
  if (successCloseBtn) successCloseBtn.addEventListener("click", closeModal);

  /* Deep-linkable: visiting the page at #share-idea opens the panel
     automatically, matching the existing #help / #delivery / #cart pattern. */
  if (window.location.hash === "#share-idea") openModal();
});
