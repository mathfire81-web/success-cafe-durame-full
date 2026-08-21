/*
  FOOD PICKER (inside the floating delivery panel)
  Renders every category/item from MENU_DATA (see js/menu-data.js) as a
  compact, scrollable list with a quantity stepper per item, so people
  can build their order without leaving the panel. Quantities read from
  and write straight to SuccessCafeCart (see js/cart.js).
*/

function fpFormatPrice(value) {
  return value.toFixed(0) + " Br";
}

function fpGetQty(cart, id) {
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id === id) return cart[i].qty;
  }
  return 0;
}

function fpBuildItemRow(item, qty) {
  return (
    '<div class="fp-item" data-item-id="' + item.id + '">' +
      '<div class="fp-item-info">' +
        '<h4>' + item.name + (item.nameAm ? ' <span class="fp-item-name-am">' + item.nameAm + '</span>' : '') + '</h4>' +
        '<span class="fp-item-price">' + fpFormatPrice(item.price) + '</span>' +
      '</div>' +
      '<div class="fp-stepper">' +
        '<button type="button" class="fp-stepper-btn fp-minus" data-item-id="' + item.id + '" aria-label="Decrease ' + item.name + ' quantity">&minus;</button>' +
        '<span class="fp-stepper-value" data-item-id="' + item.id + '">' + qty + '</span>' +
        '<button type="button" class="fp-stepper-btn fp-plus" data-item-id="' + item.id + '" aria-label="Increase ' + item.name + ' quantity">+</button>' +
      '</div>' +
    '</div>'
  );
}

function fpBuildCategoryBlock(category, cart) {
  var itemsHtml = category.items.map(function (item) {
    return fpBuildItemRow(item, fpGetQty(cart, item.id));
  }).join("");

  return (
    '<div class="fp-category">' +
      '<h3 class="fp-category-name">' + category.name + (category.nameAm ? ' <span class="fp-category-name-am">' + category.nameAm + '</span>' : '') + '</h3>' +
      itemsHtml +
    '</div>'
  );
}

function fpRenderList() {
  var list = document.getElementById("food-picker-list");
  if (!list || typeof MENU_DATA === "undefined") return;

  var cart = typeof SuccessCafeCart !== "undefined" ? SuccessCafeCart.getCart() : [];
  list.innerHTML = MENU_DATA.categories.map(function (category) {
    return fpBuildCategoryBlock(category, cart);
  }).join("");
}

function fpFindItem(id) {
  for (var c = 0; c < MENU_DATA.categories.length; c++) {
    var items = MENU_DATA.categories[c].items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
  }
  return null;
}

function fpUpdateRowQty(id, qty) {
  var valueEls = document.querySelectorAll('.fp-stepper-value[data-item-id="' + id + '"]');
  valueEls.forEach(function (el) { el.textContent = qty; });
}

/* Anything picked here came from inside the delivery panel, so tag the
   whole cart as a delivery order right away - not just once "Checkout"
   is pressed - so it reads correctly (with a fee) even if the shopper
   closes the panel and finishes from the cart drawer instead. Reuses
   whatever landmark fee is currently selected on the delivery map
   (js/delivery-map.js), falling back to the same 50 Br default the
   map's own checkout button uses when no landmark has been picked. */
function fpMarkDeliveryFulfillment() {
  if (typeof SuccessCafeCart === "undefined") return;
  var fee = (typeof dmSelectedFee !== "undefined" && dmSelectedFee) ? dmSelectedFee : 50;
  var details = (typeof dmBuildDeliveryDetails === "function") ? dmBuildDeliveryDetails() : null;
  SuccessCafeCart.setFulfillment("delivery", fee, details);
}

document.addEventListener("DOMContentLoaded", function () {
  var list = document.getElementById("food-picker-list");
  if (!list || typeof SuccessCafeCart === "undefined" || typeof MENU_DATA === "undefined") return;

  fpRenderList();

  list.addEventListener("click", function (event) {
    var minusBtn = event.target.closest(".fp-minus");
    var plusBtn = event.target.closest(".fp-plus");
    if (!minusBtn && !plusBtn) return;

    var id = (minusBtn || plusBtn).getAttribute("data-item-id");
    var cart = SuccessCafeCart.getCart();
    var currentQty = fpGetQty(cart, id);

    if (plusBtn) {
      if (currentQty === 0) {
        var item = fpFindItem(id);
        if (item) SuccessCafeCart.addItem(item);
        fpUpdateRowQty(id, 1);
      } else {
        SuccessCafeCart.setQty(id, currentQty + 1);
        fpUpdateRowQty(id, currentQty + 1);
      }
    } else if (minusBtn && currentQty > 0) {
      SuccessCafeCart.setQty(id, currentQty - 1);
      fpUpdateRowQty(id, currentQty - 1);
    }

    fpMarkDeliveryFulfillment();
  });

  /* Keep the picker in sync if the cart changes elsewhere (e.g. the
     modal was already open when something was removed via the cart drawer). */
  document.querySelectorAll(".js-delivery-trigger").forEach(function (trigger) {
    trigger.addEventListener("click", fpRenderList);
  });
});
