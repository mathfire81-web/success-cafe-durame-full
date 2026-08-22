/*
  MENU DATA - shared across menu.html (full menu) and the floating
  delivery panel's food picker. Mirrors data/menu.json, but kept as a
  JS literal so pages work when opened straight from disk (fetch() of
  a local JSON file is blocked by the browser's CORS rules there).
*/

var MENU_DATA = {
  categories: [
    {
      name: "Shewarma", nameAm: "ሽዋርማ",
      items: [
        { id: "sw-01", name: "Special Shewarma", nameAm: "ስፔሻል ሽዋርማ", description: "Our loaded house shewarma, wrapped fresh with a rich mix of fillings.", price: 700, image: "images/menu/sw-01.jpg", badge: "Popular" },
        { id: "sw-02", name: "Chicken Shewarma", nameAm: "የዶሮ ሽዋርማ", description: "Grilled spiced chicken, wrapped with fresh vegetables and sauce.", price: 650, image: "images/menu/sw-02.jpg" },
        { id: "sw-03", name: "Beef Shewarma", nameAm: "የበሬ ሽዋርማ", description: "Tender spiced beef, wrapped with fresh vegetables and sauce.", price: 600, image: "images/menu/sw-03.jpg" }
      ]
    },
    {
      name: "Burger", nameAm: "በርገር",
      items: [
        { id: "bg-01", name: "Special Burger", nameAm: "ስፔሻል በርገር", description: "Our house-special burger, loaded with extra toppings.", price: 550, image: "images/menu/bg-01.jpg", badge: "Popular" },
        { id: "bg-02", name: "Regular Burger", nameAm: "መደበኛ በርገር", description: "A classic beef patty burger with fresh vegetables and sauce.", price: 500, image: "images/menu/bg-02.jpg" },
        { id: "bg-03", name: "Chicken Burger", nameAm: "የዶሮ በርገር", description: "Grilled chicken fillet burger with fresh vegetables and sauce.", price: 500, image: "images/menu/bg-03.jpg" }
      ]
    },
    {
      name: "Pizza", nameAm: "ፒዛ",
      items: [
        { id: "pz-01", name: "Special Pizza", nameAm: "ስፔሻል ፒዛ", description: "Our house-special pizza, loaded with extra toppings and cheese.", price: 650, image: "images/menu/pz-01.jpg", badge: "Popular" },
        { id: "pz-02", name: "Margherita Pizza", nameAm: "ማርጋሪታ ፒዛ", description: "Classic tomato sauce, mozzarella and basil on our fresh crust.", price: 550, image: "images/menu/pz-02.jpg" },
        { id: "pz-03", name: "Regular Pizza", nameAm: "መደበኛ ፒዛ", description: "Our everyday favourite, simple and satisfying.", price: 550, image: "images/menu/pz-03.jpg" },
        { id: "pz-04", name: "Vegetable Pizza", nameAm: "የአትክልት ፒዛ", description: "Loaded with fresh seasonal vegetables and mozzarella.", price: 500, image: "images/menu/pz-04.jpg" },
        { id: "pz-05", name: "Chicken Pizza", nameAm: "የዶሮ ፒዛ", description: "Grilled chicken pieces with mozzarella and house sauce.", price: 600, image: "images/menu/pz-05.jpg" },
        { id: "pz-06", name: "Large Size Pizza", nameAm: "ትልቅ መጠን ፒዛ", description: "Any topping, made in our large size to share.", price: 750, image: "images/menu/pz-06.jpg" },
        { id: "pz-07", name: "Tuna Pizza", nameAm: "የቱና ፒዛ", description: "Flaked tuna, olives and mozzarella on our fresh crust.", price: 600, image: "images/menu/pz-07.jpg" },
        { id: "pz-08", name: "Extra Cheese Topping", nameAm: "ተጨማሪ አይብ", description: "Add an extra layer of melted cheese to any pizza.", price: 250, image: "images/menu/pz-08.jpg" }
      ]
    },
    {
      name: "Sandwich", nameAm: "ሳንድዊች",
      items: [
        { id: "sd-01", name: "Chicken Sandwich", nameAm: "የዶሮ ሳንድዊች", description: "Grilled chicken with fresh vegetables between toasted bread.", price: 450, image: "images/menu/sd-01.jpg" },
        { id: "sd-02", name: "Club Sandwich", nameAm: "ክለብ ሳንድዊች", description: "Layers of chicken, egg, vegetables and cheese, toasted.", price: 420, image: "images/menu/sd-02.jpg", badge: "Popular" },
        { id: "sd-03", name: "Special Sandwich", nameAm: "ስፔሻል ሳንድዊች", description: "Our house-special sandwich, loaded with extra fillings.", price: 420, image: "images/menu/sd-03.jpg" },
        { id: "sd-04", name: "Egg Sandwich", nameAm: "የእንቁላል ሳንድዊች", description: "Simple and fresh, egg with vegetables between toasted bread.", price: 300, image: "images/menu/sd-04.jpg" }
      ]
    },
    {
      name: "Omelette", nameAm: "ኦምሌት",
      items: [
        { id: "om-01", name: "Special Omelette", nameAm: "ስፔሻል ኦምሌት", description: "Our house-special omelette, loaded with extra fillings.", price: 350, image: "images/menu/om-01.jpg" },
        { id: "om-02", name: "Special Omelette with Firfir", nameAm: "ስፔሻል ኦምሌት ከፍርፍር ጋር", description: "Special omelette served with our traditional firfir.", price: 350, image: "images/menu/om-02.jpg" },
        { id: "om-03", name: "Special Omelette with Chechebsa", nameAm: "ስፔሻል ኦምሌት ከጨጨብሳ ጋር", description: "Special omelette served with our traditional chechebsa.", price: 150, image: "images/menu/om-03.jpg" },
        { id: "om-04", name: "Regular Omelette with Firfir", nameAm: "መደበኛ ኦምሌት ከፍርፍር ጋር", description: "Classic omelette served with our traditional firfir.", price: 220, image: "images/menu/om-04.jpg" },
        { id: "om-05", name: "Regular Omelette with Chechebsa", nameAm: "መደበኛ ኦምሌት ከጨጨብሳ ጋር", description: "Classic omelette served with our traditional chechebsa.", price: 300, image: "images/menu/om-05.jpg" }
      ]
    },
    {
      name: "Cake and Dessert", nameAm: "ኬክ እና ጣፋጭ",
      items: [
        { id: "ck-01", name: "Special Cake", nameAm: "ስፔሻል ኬክ", description: "Our house-special cake of the day.", price: 100, image: "images/menu/ck-01.jpg" },
        { id: "ck-02", name: "Chocolate Cake", nameAm: "የቸኮሌት ኬክ", description: "Rich, moist chocolate cake.", price: 70, image: "images/menu/ck-02.jpg" },
        { id: "ck-03", name: "Marble Cake", nameAm: "ማርብል ኬክ", description: "Classic swirled vanilla and chocolate sponge.", price: 60, image: "images/menu/ck-03.jpg" },
        { id: "ck-04", name: "Carrot Cake", nameAm: "የካሮት ኬክ", description: "Moist spiced carrot cake.", price: 65, image: "images/menu/ck-04.jpg" },
        { id: "ck-05", name: "Spice Cake", nameAm: "ስፓይስ ኬክ", description: "Warmly spiced house-baked cake.", price: 65, image: "images/menu/ck-05.jpg" },
        { id: "ck-06", name: "Fruit Biscuit", nameAm: "የፍራፍሬ ብስኩት", description: "Buttery biscuit topped with fruit.", price: 80, image: "images/menu/ck-06.jpg" },
        { id: "ck-07", name: "Black Forest Cake", nameAm: "ብላክ ፎረስት ኬክ", description: "Chocolate sponge, cherries and cream.", price: 80, image: "images/menu/ck-07.jpg" },
        { id: "ck-08", name: "Muffin", nameAm: "ማፊን", description: "Freshly baked, soft and fluffy.", price: 60, image: "images/menu/ck-08.jpg" },
        { id: "ck-09", name: "Habesha Cake", nameAm: "የሀበሻ ኬክ", description: "Traditional-style cake, house recipe.", price: 60, image: "images/menu/ck-09.jpg" },
        { id: "ck-10", name: "Danish Pastry", nameAm: "ዳኒሽ", description: "Flaky, lightly sweet laminated pastry.", price: 65, image: "images/menu/ck-10.jpg" },
        { id: "ck-11", name: "Croissant", nameAm: "ክሮሳንት", description: "Flaky, buttery, baked fresh each morning.", price: 70, image: "images/menu/ck-11.jpg" },
        { id: "ck-12", name: "Cheesecake", nameAm: "ቺዝኬክ", description: "Creamy baked cheesecake on a biscuit base.", price: 65, image: "images/menu/ck-12.jpg" },
        { id: "ck-13", name: "Doughnut", nameAm: "ዶናት", description: "Soft, glazed and fried fresh.", price: 80, image: "images/menu/ck-13.jpg" },
        { id: "ck-14", name: "Tiramisu", nameAm: "ቲራሚሱ", description: "Coffee-soaked layers with mascarpone cream.", price: 100, image: "images/menu/ck-14.jpg" },
        { id: "ck-15", name: "Large Cake Slice", nameAm: "ትልቅ ቁራጭ ኬክ", description: "A generous slice from our full cakes.", price: 200, image: "images/menu/ck-15.jpg" }
      ]
    },
    {
      name: "Ice Cream", nameAm: "አይስ ክሬም",
      items: [
        { id: "ic-01", name: "Chocolate Ice Cream", nameAm: "የቸኮሌት አይስ ክሬም", description: "Rich and creamy, scooped fresh.", price: 200, image: "images/menu/ic-01.jpg" },
        { id: "ic-02", name: "Vanilla Ice Cream", nameAm: "የቫኒላ አይስ ክሬም", description: "Classic and smooth, scooped fresh.", price: 200, image: "images/menu/ic-02.jpg" },
        { id: "ic-03", name: "Strawberry Ice Cream", nameAm: "የእንጆሪ አይስ ክሬም", description: "Fruity and creamy, scooped fresh.", price: 200, image: "images/menu/ic-03.jpg" }
      ]
    },
    {
      name: "Shake and Juice", nameAm: "ሸክ እና ጁስ",
      items: [
        { id: "sj-01", name: "Special Shake", nameAm: "ስፔሻል ሸክ", description: "Our house-special blended shake.", price: 200, image: "images/menu/sj-01.jpg", badge: "Popular" },
        { id: "sj-02", name: "Mango Juice", nameAm: "የማንጎ ጁስ", description: "Fresh mango, blended smooth.", price: 150, image: "images/menu/sj-02.jpg" },
        { id: "sj-03", name: "Avocado Juice", nameAm: "የአቮካዶ ጁስ", description: "Fresh avocado, blended smooth.", price: 150, image: "images/menu/sj-03.jpg" },
        { id: "sj-04", name: "Papaya Juice", nameAm: "የፓፓያ ጁስ", description: "Fresh papaya, blended smooth.", price: 150, image: "images/menu/sj-04.jpg" },
        { id: "sj-05", name: "Strawberry Juice", nameAm: "የእንጆሪ ጁስ", description: "Fresh strawberry, blended smooth.", price: 150, image: "images/menu/sj-05.jpg" },
        { id: "sj-06", name: "Pineapple Juice", nameAm: "የአናናስ ጁስ", description: "Fresh pineapple, blended smooth.", price: 150, image: "images/menu/sj-06.jpg" },
        { id: "sj-07", name: "Avocado Shake", nameAm: "የአቮካዶ ሸክ", description: "Fresh avocado blended with milk.", price: 170, image: "images/menu/sj-07.jpg" },
        { id: "sj-08", name: "Mango Shake", nameAm: "የማንጎ ሸክ", description: "Fresh mango blended with milk.", price: 170, image: "images/menu/sj-08.jpg" },
        { id: "sj-09", name: "Banana Shake", nameAm: "የሙዝ ሸክ", description: "Fresh banana blended with milk.", price: 170, image: "images/menu/sj-09.jpg" },
        { id: "sj-10", name: "Papaya Shake", nameAm: "የፓፓያ ሸክ", description: "Fresh papaya blended with milk.", price: 170, image: "images/menu/sj-10.jpg" },
        { id: "sj-11", name: "Carrot Shake", nameAm: "የካሮት ሸክ", description: "Fresh carrot blended with milk.", price: 170, image: "images/menu/sj-11.jpg" },
        { id: "sj-12", name: "Mixed Fruit Special", nameAm: "ድብልቅ ፍራፍሬ ልዩ", description: "Our layered mix of fresh seasonal fruit juices.", price: 390, image: "images/menu/sj-12.jpg" }
      ]
    },
    {
      name: "Hot Drink", nameAm: "ትኩስ መጠጥ",
      items: [
        { id: "hd-01", name: "Hot Chocolate", nameAm: "ሆት ቾኮሌት", description: "Rich and warming, topped with a light foam.", price: 120, image: "images/menu/hd-01.jpg" },
        { id: "hd-02", name: "Cappuccino", nameAm: "ካፑችኖ", description: "Espresso, steamed milk and airy foam.", price: 120, image: "images/menu/hd-02.jpg" },
        { id: "hd-03", name: "Macchiato", nameAm: "ማኪያቶ", description: "Espresso marked with a dollop of foamed milk - a Success Cafe favourite.", price: 60, image: "images/menu/hd-03.jpg", badge: "Signature" },
        { id: "hd-04", name: "Milk", nameAm: "ወተት", description: "Warm steamed milk.", price: 60, image: "images/menu/hd-04.jpg" },
        { id: "hd-05", name: "Roasted Peanuts", nameAm: "የተጠበሰ ለውዝ", description: "A warm, salted snack alongside your drink.", price: 60, image: "images/menu/hd-05.jpg" },
        { id: "hd-06", name: "Peanuts with Milk", nameAm: "ለውዝ በወተት", description: "Roasted peanuts served with warm milk.", price: 80, image: "images/menu/hd-06.jpg" },
        { id: "hd-07", name: "Buna (Black Coffee)", nameAm: "ቡና", description: "Traditional Ethiopian black coffee, brewed strong.", price: 40, image: "images/menu/hd-07.jpg" },
        { id: "hd-08", name: "Buna with Sugar", nameAm: "ቡና በስኳር", description: "Traditional black coffee, lightly sweetened.", price: 50, image: "images/menu/hd-08.jpg" },
        { id: "hd-09", name: "Herbal Tea", nameAm: "የእፅዋት ሻይ", description: "A light, soothing herbal infusion.", price: 40, image: "images/menu/hd-09.jpg" },
        { id: "hd-10", name: "Special Tea", nameAm: "ስፔሻል ሻይ", description: "Our house-special blended tea.", price: 100, image: "images/menu/hd-10.jpg" },
        { id: "hd-11", name: "Ginger Tea", nameAm: "የዝንጅብል ሻይ", description: "Warming black tea brewed with fresh ginger.", price: 60, image: "images/menu/hd-11.jpg" },
        { id: "hd-12", name: "Lemon Tea", nameAm: "የሎሚ ሻይ", description: "Black tea brightened with fresh lemon.", price: 50, image: "images/menu/hd-12.jpg" },
        { id: "hd-13", name: "Cinnamon Tea", nameAm: "የቀረፋ ሻይ", description: "Black tea brewed with warm cinnamon.", price: 55, image: "images/menu/hd-13.jpg" },
        { id: "hd-14", name: "Soft Drink", nameAm: "ለስላሳ መጠጥ", description: "Chilled bottled soft drink.", price: 60, image: "images/menu/hd-14.jpg" },
        { id: "hd-15", name: "Tea", nameAm: "ሻይ", description: "Plain black tea.", price: 15, image: "images/menu/hd-15.jpg" }
      ]
    }
  ]
};
