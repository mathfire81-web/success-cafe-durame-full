/*
  MENU JS
  Renders the full menu (grouped by category), wires up the category
  filter bar, and hooks "Add to Cart" buttons into the shared
  SuccessCafeCart utility (see cart.js). Menu data lives in the
  separately-loaded js/menu-data.js (MENU_DATA), shared with the
  floating delivery panel's food picker.
*/

function formatPrice(value) {
  return value.toFixed(0) + " Br";
}

function buildItemCard(item) {
  var badge = item.badge
    ? '<span class="item-card-badge">' + item.badge + "</span>"
    : "";
  var nameAm = item.nameAm
    ? '<span class="item-card-name-am" lang="am">' + item.nameAm + "</span>"
    : "";
  return (
    '<div class="item-card">' +
      '<div class="item-card-media">' +
        badge +
        '<img src="' + item.image + '" alt="' + item.name + '" loading="lazy">' +
      "</div>" +
      '<div class="item-card-body">' +
        '<div class="item-card-top">' +
          '<div class="item-card-title">' +
            "<h3>" + item.name + "</h3>" +
            nameAm +
          "</div>" +
          '<span class="item-card-price">' + formatPrice(item.price) + "</span>" +
        "</div>" +
        '<p class="item-card-desc">' + item.description + "</p>" +
        '<button type="button" class="item-card-add" data-item-id="' + item.id + '">Add to Cart</button>' +
      "</div>" +
    "</div>"
  );
}

function buildCategoryBlock(category) {
  var slug = category.name.toLowerCase().replace(/\s+/g, "-");
  var cardsHtml = category.items.map(buildItemCard).join("");
  var nameAm = category.nameAm
    ? '<span class="menu-category-name-am" lang="am">' + category.nameAm + "</span>"
    : "";
  return (
    '<div class="menu-category-block" data-category="' + slug + '">' +
      '<div class="menu-category-head">' +
        '<div class="menu-category-title">' +
          "<h2>" + category.name + "</h2>" +
          nameAm +
        "</div>" +
        '<span class="menu-category-count">' + category.items.length + " items</span>" +
      "</div>" +
      '<div class="menu-items-grid">' + cardsHtml + "</div>" +
    "</div>"
  );
}

function renderMenu() {
  var listing = document.getElementById("menu-listing");
  if (!listing) return;
  listing.innerHTML = MENU_DATA.categories.map(buildCategoryBlock).join("");
}

function renderFilterBar() {
  var bar = document.getElementById("menu-filter-row");
  if (!bar) return;

  var buttonsHtml = '<button type="button" class="menu-filter-btn is-active" data-filter="all">All</button>';
  MENU_DATA.categories.forEach(function (category) {
    var slug = category.name.toLowerCase().replace(/\s+/g, "-");
    var label = category.name;
    if (category.nameAm) {
      label += ' <span class="filter-btn-am" lang="am">/ ' + category.nameAm + "</span>";
    }
    buttonsHtml += '<button type="button" class="menu-filter-btn" data-filter="' + slug + '">' + label + "</button>";
  });
  bar.innerHTML = buttonsHtml;
}

function wireFilterBar() {
  var bar = document.getElementById("menu-filter-row");
  var blocks = document.querySelectorAll(".menu-category-block");
  if (!bar) return;

  bar.addEventListener("click", function (event) {
    var btn = event.target.closest(".menu-filter-btn");
    if (!btn) return;

    bar.querySelectorAll(".menu-filter-btn").forEach(function (b) {
      b.classList.remove("is-active");
    });
    btn.classList.add("is-active");

    var filter = btn.getAttribute("data-filter");
    blocks.forEach(function (block) {
      var match = filter === "all" || block.getAttribute("data-category") === filter;
      block.style.display = match ? "" : "none";
    });
  });
}

function wireAddToCart() {
  var listing = document.getElementById("menu-listing");
  if (!listing) return;

  listing.addEventListener("click", function (event) {
    var btn = event.target.closest(".item-card-add");
    if (!btn) return;

    var id = btn.getAttribute("data-item-id");
    var item = null;
    for (var c = 0; c < MENU_DATA.categories.length; c++) {
      for (var i = 0; i < MENU_DATA.categories[c].items.length; i++) {
        if (MENU_DATA.categories[c].items[i].id === id) {
          item = MENU_DATA.categories[c].items[i];
        }
      }
    }
    if (!item || typeof SuccessCafeCart === "undefined") return;

    SuccessCafeCart.addItem(item);
    /* Added straight from the menu grid (not the delivery panel's food
       picker) - always an in-cafe item. The delivery panel's own
       Checkout button re-tags the order "delivery" right before it
       navigates to checkout, so it's still safe to add more items from
       here in between without losing that - but adding from here should
       never itself leave a stale "delivery" tag in place for the next,
       unrelated in-cafe order. */
    SuccessCafeCart.setFulfillment("in-cafe", 0);

    var card = btn.closest(".item-card");
    var thumb = card ? card.querySelector(".item-card-media img") : null;
    SuccessCafeCart.flyToCart(thumb || btn, item.image);

    var originalText = btn.textContent;
    btn.textContent = "Added ✓";
    btn.classList.add("is-added");
    btn.disabled = true;
    setTimeout(function () {
      btn.textContent = originalText;
      btn.classList.remove("is-added");
      btn.disabled = false;
    }, 1100);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  renderFilterBar();
  renderMenu();
  wireFilterBar();
  wireAddToCart();
  if (typeof SuccessCafeCart !== "undefined") {
    SuccessCafeCart.updateCartBadge();
  }
});
