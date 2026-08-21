/*
  Mirrors CAFE_LOCATION + LANDMARKS in js/delivery-map.js. This is the
  seed source for the delivery_landmarks table - if a new landmark is
  added on the frontend map, add it here too and re-run
  `npm run seed` so the backend can price it.
*/

const CAFE_LOCATION = { lat: 7.2449066412107825, lng: 37.90079484003493 };

const LANDMARKS = [
  { id: "hambo-church", name: "Durame Hambo Kalehiwet Church", lat: 7.251010349648522, lng: 37.90914868801586 },
  { id: "higa-school", name: "Higa Model Boarding School", lat: 7.243944488958062, lng: 37.90719042968092 },
  { id: "aberash-hotel", name: "Aberash Hotel", lat: 7.240810360482482, lng: 37.895540383624805 },
  { id: "kale-heiwot-1", name: "Durame Kale Heiwot Church #1", lat: 7.239226316411734, lng: 37.89376905914108 },
  { id: "bilal-mosque", name: "Durame Bilal Mosque (ዱራሜ ቢላል መስጂድ)", lat: 7.239725306030645, lng: 37.90417962663293 },
  { id: "apostolic-church", name: "Durame Apostolic Church", lat: 7.245000153241193, lng: 37.90492856893984 },
  { id: "stadium", name: "Durame Stadium", lat: 7.247135928043366, lng: 37.90472224272433 },
  { id: "utubo-adebabay", name: "Durame Utubo Adebabay", lat: 7.245400, lng: 37.902100, approx: true }
];

module.exports = { CAFE_LOCATION, LANDMARKS };
