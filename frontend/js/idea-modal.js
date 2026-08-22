/*
  SHARE AN IDEA MODAL CONTROLLER
  The "Share an Idea" fab (and any ".js-idea-trigger") opens a floating
  panel with a short form: name, email, category, and a free-text idea.
  On submit this POSTs to /api/ideas (see js/api-config.js for
  API_BASE_URL) - the same fetch pattern js/payment.js uses for orders -
  and only shows the thank-you state once the server confirms it saved.
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
    var errorEl = document.getElementById("idea-form-error");
    if (errorEl) errorEl.style.display = "none";
    var submitBtn = document.getElementById("idea-form-submit-btn");
    if (submitBtn) submitBtn.disabled = false;
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

  var submitBtn = document.getElementById("idea-form-submit-btn");
  var submitLabel = submitBtn ? submitBtn.querySelector(".idea-form-submit-label") : null;
  var errorEl = document.getElementById("idea-form-error");

  function showIdeaError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.style.display = "";
  }

  function clearIdeaError() {
    if (!errorEl) return;
    errorEl.style.display = "none";
  }

  function submitIdea() {
    return fetch((window.API_BASE_URL || "") + "/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.getElementById("idea-name").value.trim(),
        email: document.getElementById("idea-email").value.trim(),
        category: document.getElementById("idea-category").value,
        message: document.getElementById("idea-message").value.trim()
      })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || "Something went wrong sending your idea.");
        return data;
      });
    });
  }

  /* Validates locally first (same as before), then sends the idea to
     the server and only shows the thank-you state once it's actually
     saved - so a submission never silently disappears on a bad
     connection. */
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      clearIdeaError();
      if (submitBtn) submitBtn.disabled = true;
      if (submitLabel) submitLabel.textContent = "Sending...";

      submitIdea()
        .then(function () {
          form.style.display = "none";
          if (successPanel) successPanel.classList.add("is-visible");
        })
        .catch(function (err) {
          showIdeaError(err.message || "Something went wrong sending your idea. Please try again.");
        })
        .then(function () {
          if (submitBtn) submitBtn.disabled = false;
          if (submitLabel) submitLabel.textContent = "Send Idea (\u120b\u12ad)";
        });
    });
  }

  var successCloseBtn = overlay.querySelector(".js-idea-close");
  if (successCloseBtn) successCloseBtn.addEventListener("click", closeModal);

  /* Deep-linkable: visiting the page at #share-idea opens the panel
     automatically, matching the existing #help / #delivery / #cart pattern. */
  if (window.location.hash === "#share-idea") openModal();
});
