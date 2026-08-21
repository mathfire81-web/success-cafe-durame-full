/*
  MAIN JS - Success Cafe, Durame Town
  Shared site behavior used across all pages: sticky header shadow on
  scroll, and mobile nav toggle.
*/

document.addEventListener("DOMContentLoaded", function () {
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav-links");

  if (header) {
    var onScroll = function () {
      if (window.scrollY > 40) {
        header.classList.add("is-scrolled");
      } else {
        header.classList.remove("is-scrolled");
      }
    };
    window.addEventListener("scroll", onScroll);
    onScroll();
  }

  /* Tuck the floating "Share an Idea" / "Want Help?" fabs out of the way
     while actively scrolling down, so they never sit on top of a menu
     card's "Add to Cart" button. They reappear on scroll-up or once
     scrolling settles for a moment. */
  var fabHelpers = document.querySelectorAll(".fab-helper");
  if (fabHelpers.length) {
    var lastScrollY = window.scrollY;
    var settleTimer = null;
    var onFabScroll = function () {
      var currentY = window.scrollY;
      var scrollingDown = currentY > lastScrollY + 4;
      var scrollingUp = currentY < lastScrollY - 4;

      if (scrollingDown && currentY > 80) {
        fabHelpers.forEach(function (fab) { fab.classList.add("is-tucked"); });
      } else if (scrollingUp || currentY <= 80) {
        fabHelpers.forEach(function (fab) { fab.classList.remove("is-tucked"); });
      }
      lastScrollY = currentY;

      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(function () {
        fabHelpers.forEach(function (fab) { fab.classList.remove("is-tucked"); });
      }, 900);
    };
    window.addEventListener("scroll", onFabScroll, { passive: true });
  }

  if (toggle && nav) {
    var closeNav = function () {
      nav.classList.remove("nav-links-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    };
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("nav-links-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.classList.toggle("nav-open", isOpen);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
  }

  /* Keep the header cart badge(s) in sync with saved cart, on every page.
     There are now two: the desktop header icon and the mobile FAB. */
  var cartCountEls = document.querySelectorAll(".cart-count");
  if (cartCountEls.length) {
    var count = 0;
    try {
      var savedCart = JSON.parse(localStorage.getItem("successCafeCart")) || [];
      count = savedCart.reduce(function (sum, item) { return sum + (item.qty || 0); }, 0);
    } catch (e) {
      count = 0;
    }
    cartCountEls.forEach(function (el) { el.textContent = count; });
  }
});
