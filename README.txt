IN MOTION ONLINE STORE
======================
Plain static website (no server, no database). Works on any free static host:
Netlify, Cloudflare Pages or GitHub Pages.

Files
- config.js     WhatsApp number, Google Sheet link, delivery prices, email, Instagram
- products.csv  backup product list (used if the Google Sheet can't be read)
- images/       product photos
- index.html, shop.html, product.html, style.css, app.js  (the website itself)

Products come from the Google Sheet "In Motion Store – Products".
Columns: id, name, category, gender (Men/Women/Unisex), price, sale_price,
sizes (S|M|L), colour, image, image2, tag, featured (yes/no), in_stock (yes/no), description
Optional extra columns: image3, hidden (yes = don't show).
Images: a link to a photo (Google Drive share link works if the file is shared
"Anyone with the link"), or images/filename.jpg for photos uploaded with the site.
