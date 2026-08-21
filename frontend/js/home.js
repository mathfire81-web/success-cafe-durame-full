/*
  HOME JS
  Wires up "Add to Cart" buttons on the "Mostly Ordered" preview cards
  (index.html) into the shared SuccessCafeCart utility (see cart.js),
  and runs the About Intro photo slideshow (autoplay + manual controls).
*/

function wireHomeMenuAddToCart() {
  var grid = document.getElementById("home-menu-grid");
  if (!grid) return;

  grid.addEventListener("click", function (event) {
    var btn = event.target.closest(".menu-card-add");
    if (!btn || typeof SuccessCafeCart === "undefined") return;

    var item = {
      id: btn.getAttribute("data-item-id"),
      name: btn.getAttribute("data-item-name"),
      price: parseFloat(btn.getAttribute("data-item-price")),
      image: btn.getAttribute("data-item-image")
    };
    if (!item.id) return;

    SuccessCafeCart.addItem(item);
    /* Added straight from the home page grid (not the delivery panel's
       food picker). Same reasoning as menu.js's wireAddToCart: don't
       clobber an in-progress delivery order (fee + confirmed landmark
       details) just because one more item was added from a plain
       menu grid - only default to "in-cafe" when it wasn't already
       "delivery". */
    if (SuccessCafeCart.getFulfillment().method !== "delivery") {
      SuccessCafeCart.setFulfillment("in-cafe", 0);
    }

    var card = btn.closest(".menu-card");
    var thumb = card ? card.querySelector(".menu-card-media img") : null;
    SuccessCafeCart.flyToCart(thumb || btn, item.image);

    var originalHtml = btn.innerHTML;
    btn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-cart"></use></svg>Added \u2713';
    btn.classList.add("is-added");
    btn.disabled = true;
    setTimeout(function () {
      btn.innerHTML = originalHtml;
      btn.classList.remove("is-added");
      btn.disabled = false;
    }, 1100);
  });
}

var ABOUT_SLIDESHOW_INTERVAL = 4500;

function wireAboutSlideshow() {
  var slideshow = document.getElementById("about-slideshow");
  var prevBtn = document.getElementById("about-slide-prev");
  var nextBtn = document.getElementById("about-slide-next");
  var dotsWrap = document.getElementById("about-slide-dots");
  if (!slideshow) return;

  var slides = Array.prototype.slice.call(slideshow.querySelectorAll(".about-slide"));
  if (!slides.length) return;

  var index = slides.findIndex(function (slide) { return slide.classList.contains("is-active"); });
  if (index < 0) index = 0;
  var timer = null;

  function renderDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = slides.map(function (_, i) {
      var activeClass = i === index ? " is-active" : "";
      return '<button type="button" class="about-slide-dot' + activeClass + '" data-index="' + i + '" aria-label="Show photo ' + (i + 1) + '"></button>';
    }).join("");
  }

  function showSlide(nextIndex) {
    index = (nextIndex + slides.length) % slides.length;
    slides.forEach(function (slide, i) {
      slide.classList.toggle("is-active", i === index);
    });
    renderDots();
  }

  function startAutoplay() {
    stopAutoplay();
    timer = setInterval(function () { showSlide(index + 1); }, ABOUT_SLIDESHOW_INTERVAL);
  }

  function stopAutoplay() {
    if (timer) clearInterval(timer);
  }

  function goToSlide(nextIndex) {
    showSlide(nextIndex);
    startAutoplay();
  }

  if (prevBtn) prevBtn.addEventListener("click", function () { goToSlide(index - 1); });
  if (nextBtn) nextBtn.addEventListener("click", function () { goToSlide(index + 1); });
  if (dotsWrap) {
    dotsWrap.addEventListener("click", function (event) {
      var dot = event.target.closest(".about-slide-dot");
      if (!dot) return;
      goToSlide(parseInt(dot.getAttribute("data-index"), 10));
    });
  }

  slideshow.addEventListener("mouseenter", stopAutoplay);
  slideshow.addEventListener("mouseleave", startAutoplay);

  renderDots();
  startAutoplay();
}

document.addEventListener("DOMContentLoaded", function () {
  wireHomeMenuAddToCart();
  wireAboutSlideshow();
  if (typeof SuccessCafeCart !== "undefined") {
    SuccessCafeCart.updateCartBadge();
  }
});
