/* =========================================================
   IN MOTION STORE SETTINGS  (edit the text between the quotes)
   ========================================================= */
window.STORE = {
  name: "IN MOTION",
  slogan: "Rooted in Faith. Powered in Motion.",

  // Orders are sent to this WhatsApp number. Country code, no + and no spaces.
  // Example for 082 123 4567 in South Africa: "27821234567"
  whatsapp: "27627792716",

  // Your products Google Sheet (it must be shared as "Anyone with the link: Viewer").
  // If the sheet can't be read, the site uses products.csv in this folder instead.
  sheetUrl: "https://docs.google.com/spreadsheets/d/1NVxmtqA0BLJTcEhE5yauCy7WQxn2BmpolPx_h7HeGdY/edit",

  currency: "R",
  email: "hello@inmotion.co.za",
  // Paste your page links here. Leave "" to hide an icon.
  instagram: "",
  facebook: "",
  location: "Cape Town, South Africa",

  // Delivery options shown at checkout. price 0 = free.
  delivery: [
    { label: "Collect in Cape Town", price: 0 },
    { label: "Courier (South Africa)", price: 100 }
  ],
  freeDeliveryOver: 1000
};
