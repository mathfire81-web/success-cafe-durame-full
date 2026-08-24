/*
  MENU DATA LOADER
  Used to be a hardcoded MENU_DATA literal (mirrors data/menu.json).
  Now fetches the live menu from the API instead, so admin dashboard
  changes - availability toggles, price edits, new items, photos -
  actually show up on the site instead of being silently ignored.
  GET /api/menu already filters out anything toggled unavailable
  (see backend/src/routes/menu.js), so nothing else needs to filter
  here.

  window.MENU_DATA starts as an empty shell so any script that reads
  it before the fetch resolves doesn't throw. Scripts that render
  from it (menu.js, food-picker.js, preorder-modal.js) should do that
  rendering inside a `window.MENU_DATA_READY.then(...)` instead of
  assuming MENU_DATA is already populated the moment this script tag
  runs - that assumption was fine for a synchronous literal, but not
  for a fetch.

  IDs: the API returns numeric ids (menu_items.id), but every place
  that reads MENU_DATA (cart.js, menu.js, food-picker.js,
  preorder-modal.js) does strict `===` comparisons against ids that
  arrive as strings from DOM attributes (data-item-id via
  getAttribute always returns a string). The old static data used
  string ids ("sw-01") so this never surfaced. Coerce every item id
  to a string here so the rest of the app keeps working unchanged.
*/
window.MENU_DATA = { categories: [] };

window.MENU_DATA_READY = fetch((window.API_BASE_URL || "") + "/api/menu")
  .then(function (res) {
    if (!res.ok) throw new Error("Failed to load menu (" + res.status + ")");
    return res.json();
  })
  .then(function (data) {
    (data.categories || []).forEach(function (category) {
      (category.items || []).forEach(function (item) {
        item.id = String(item.id);
      });
    });
    window.MENU_DATA = data;
    return window.MENU_DATA;
  })
  .catch(function (err) {
    console.error("Could not load menu:", err);
    return window.MENU_DATA;
  });
