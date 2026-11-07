/* In Motion store: products, cart and WhatsApp checkout.
   You normally never need to edit this file. Products live in products.csv
   (or your Google Sheet) and settings live in config.js. */
(function () {
  const S = window.STORE || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = n => (S.currency || "R") + Number(n || 0).toLocaleString("en-ZA", { maximumFractionDigits: 2 });
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const yes = v => /^(yes|y|true|1|ja|نعم)$/i.test(String(v || "").trim());

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    const rows = []; let row = [], f = "", q = false;
    text = text.replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(f); rows.push(row); row = []; f = "";
      } else f += c;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    const head = (rows.shift() || []).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
    return rows.filter(r => r.some(x => x.trim() !== "")).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
  }

  // Turns Google Drive share links into direct image links.
  function img(u) {
    u = (u || "").trim();
    const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
    return m ? "https://lh3.googleusercontent.com/d/" + m[1] : u;
  }
  // Accepts a normal Google Sheet link or a "Publish to web" CSV link.
  function sheetCsvUrl(u) {
    if (!u) return "";
    if (/output=csv|tqx=out:csv/.test(u)) return u;
    const m = u.match(/spreadsheets\/d\/([\w-]+)/);
    if (m) {
      const g = u.match(/[#&?]gid=(\d+)/);
      return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv&headers=1${g ? "&gid=" + g[1] : ""}`;
    }
    return u;
  }

  function normalise(r, i) {
    const price = parseFloat(String(r.price).replace(/[^\d.]/g, "")) || 0;
    const sale = parseFloat(String(r.sale_price).replace(/[^\d.]/g, "")) || 0;
    const name = r.name || "Product";
    return {
      id: r.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "p" + i,
      name, category: r.category || "Other", gender: r.gender || "Unisex",
      price: sale && sale < price ? sale : price, was: sale && sale < price ? price : 0,
      sizes: (r.sizes || "").split(/[|/;]/).map(s => s.trim()).filter(Boolean),
      colour: r.colour || r.color || "",
      images: [r.image, r.image2, r.image3].map(img).filter(Boolean),
      tag: r.tag || "", featured: yes(r.featured),
      inStock: r.in_stock === undefined || r.in_stock === "" ? true : yes(r.in_stock),
      hidden: yes(r.hidden),
      description: r.description || ""
    };
  }

  async function loadProducts() {
    const tryLoad = async url => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      const rows = parseCSV(await res.text());
      if (!rows.length || !("name" in rows[0])) throw new Error("bad sheet");
      return rows;
    };
    let rows;
    try { rows = S.sheetUrl ? await tryLoad(sheetCsvUrl(S.sheetUrl)) : await tryLoad("products.csv"); }
    catch (e) { console.warn("Product sheet failed, using products.csv", e); rows = await tryLoad("products.csv").catch(() => []); }
    return rows.map(normalise).filter(p => !p.hidden && p.name);
  }

  /* ---------- cart ---------- */
  const KEY = "inmotion_cart";
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { cart = []; }
  const saveCart = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} renderCart(); };
  let PRODUCTS = [];
  const find = id => PRODUCTS.find(p => p.id === id);

  function addToCart(id, size, qty = 1) {
    const p = find(id); if (!p || !p.inStock) return;
    const line = cart.find(l => l.id === id && l.size === size);
    if (line) line.qty += qty; else cart.push({ id, size, qty });
    saveCart(); openDrawer(); toast(p.name + " added to bag");
  }
  const lines = () => cart.map(l => ({ ...l, p: find(l.id) })).filter(l => l.p);
  const subtotal = () => lines().reduce((s, l) => s + l.p.price * l.qty, 0);

  /* ---------- layout ---------- */
  const icons = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };
  const waLink = text => `https://wa.me/${(S.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

  function layout() {
    const here = location.pathname.split("/").pop() + location.search;
    const nav = [["shop.html", "Shop all"], ["shop.html?g=Men", "Men"], ["shop.html?g=Women", "Women"], ["shop.html?c=Accessories", "Accessories"], ["index.html#club", "The Club"]];
    const links = nav.map(([h, t]) => `<a href="${h}" class="${here === h ? "on" : ""}">${t}</a>`).join("");
    document.body.insertAdjacentHTML("afterbegin", `
      <div class="announce">Free delivery on orders over <b>${money(S.freeDeliveryOver || 0)}</b> · Order easily on WhatsApp</div>
      <header class="site"><div class="wrap nav">
        <button class="icon-btn menu-btn" id="menuBtn" aria-label="Menu">${icons.menu}</button>
        <nav class="nav-links">${links}</nav>
        <a class="brand" href="index.html" aria-label="${esc(S.name)} home"><img src="images/logo.svg" alt=""><span>${esc(S.name)}</span></a>
        <div class="nav-icons">
          <button class="icon-btn" id="searchBtn" aria-label="Search">${icons.search}</button>
          <button class="icon-btn" id="bagBtn" aria-label="Bag">${icons.bag}<span class="count" id="count" hidden>0</span></button>
        </div>
      </div><nav class="mobile-nav" id="mobileNav">${links}</nav></header>
      <div class="search" id="search"><div class="wrap">
        <div style="display:flex;gap:12px;align-items:center"><input id="q" placeholder="Search products" autocomplete="off"><button class="icon-btn" id="searchClose" aria-label="Close">${icons.close}</button></div>
        <div class="results" id="results"></div></div></div>
      <div class="overlay" id="overlay"></div>
      <aside class="drawer" id="drawer" aria-label="Shopping bag">
        <div class="drawer-head"><h3>Your bag</h3><button class="icon-btn" id="drawerClose" aria-label="Close">${icons.close}</button></div>
        <div class="drawer-body" id="drawerBody"></div><div class="drawer-foot" id="drawerFoot"></div>
      </aside><div class="toast" id="toast"></div>`);
    document.body.insertAdjacentHTML("beforeend", `
      <footer class="site"><div class="wrap">
        <div class="foot">
          <div><a class="brand" href="index.html"><img src="images/logo.svg" alt=""><span style="color:#fff">${esc(S.name)}</span></a>
            <div class="slogan">${esc(S.slogan)}</div>
            <p>A fitness, sporting movement and premium athletic wear brand from ${esc(S.location)}.</p></div>
          <div><h4>Shop</h4><ul><li><a href="shop.html">Shop all</a></li><li><a href="shop.html?g=Men">Men</a></li><li><a href="shop.html?g=Women">Women</a></li><li><a href="shop.html?c=Hoodies">Hoodies</a></li><li><a href="shop.html?c=Accessories">Accessories</a></li></ul></div>
          <div><h4>Help</h4><ul><li><a href="${waLink("Hi In Motion, I have a question.")}" target="_blank" rel="noopener">WhatsApp us</a></li><li><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></li><li><a href="${esc(S.instagram)}" target="_blank" rel="noopener">Instagram</a></li><li>Sizes & exchanges: message us</li></ul></div>
          <div><h4>Join the movement</h4><p>New drops and Thursday sessions, first.</p>
            <form class="news" id="news"><input type="email" required placeholder="Your email"><button>Join</button></form></div>
        </div>
        <div class="legal"><span>© ${new Date().getFullYear()} ${esc(S.name)}. All rights reserved.</span><span>Premium performance. Honest price.</span></div>
      </div></footer>`);

    $("#menuBtn").onclick = () => $("#mobileNav").classList.toggle("on");
    $("#bagBtn").onclick = openDrawer;
    $("#drawerClose").onclick = closeAll; $("#overlay").onclick = closeAll;
    $("#searchBtn").onclick = () => { $("#search").classList.add("on"); $("#overlay").classList.add("on"); setTimeout(() => $("#q").focus(), 200); runSearch(); };
    $("#searchClose").onclick = closeAll;
    $("#q").oninput = runSearch;
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });
    $("#news").onsubmit = e => {
      e.preventDefault();
      const em = $("input", e.target).value;
      window.open(waLink(`Hi In Motion, please add me to the list for new drops: ${em}`), "_blank");
      e.target.reset(); toast("Thanks for joining");
    };
  }
  function openDrawer() { $("#drawer").classList.add("on"); $("#overlay").classList.add("on"); }
  function closeAll() { ["#drawer", "#overlay", "#search"].forEach(s => $(s).classList.remove("on")); }
  let tt; function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("on"), 2200); }

  function runSearch() {
    const q = $("#q").value.trim().toLowerCase();
    const list = PRODUCTS.filter(p => !q || (p.name + " " + p.category + " " + p.colour + " " + p.gender + " " + p.description).toLowerCase().includes(q));
    $("#results").innerHTML = list.length ? list.map(p => `<a href="product.html?id=${encodeURIComponent(p.id)}"><img src="${esc(p.images[0] || "images/logo.svg")}" alt="" loading="lazy"><div><b>${esc(p.name)}</b><br>${money(p.price)}</div></a>`).join("") : `<p style="color:var(--muted)">No products found.</p>`;
  }

  /* ---------- bag + checkout ---------- */
  function renderCart() {
    const n = cart.reduce((s, l) => s + l.qty, 0);
    const c = $("#count"); if (c) { c.textContent = n; c.hidden = !n; }
    const body = $("#drawerBody"); if (!body) return;
    const ls = lines();
    if (!ls.length) {
      body.innerHTML = `<div class="empty"><p>Your bag is empty.</p><a class="btn btn-dark" style="margin-top:20px" href="shop.html">Shop now</a></div>`;
      $("#drawerFoot").innerHTML = ""; return;
    }
    body.innerHTML = ls.map((l, i) => `<div class="line">
      <img src="${esc(l.p.images[0] || "images/logo.svg")}" alt="">
      <div><h4>${esc(l.p.name)}</h4><div class="sub">${[l.p.colour, l.size].filter(Boolean).map(esc).join(" · ")}</div>
        <div class="qty"><button data-q="${i}" data-d="-1" aria-label="Less">−</button><span>${l.qty}</span><button data-q="${i}" data-d="1" aria-label="More">+</button></div><br>
        <button class="remove" data-r="${i}">Remove</button></div>
      <div style="font-weight:600">${money(l.p.price * l.qty)}</div></div>`).join("");
    const del = S.delivery || [];
    const sub = subtotal();
    $("#drawerFoot").innerHTML = `
      <div class="field"><label>Delivery</label><select id="del">${del.map((d, i) => `<option value="${i}">${esc(d.label)}${d.price && !(S.freeDeliveryOver && sub >= S.freeDeliveryOver) ? " · " + money(d.price) : " · Free"}</option>`).join("")}</select></div>
      <div class="field"><label>Your name</label><input id="cName" autocomplete="name"></div>
      <div class="field" id="addrWrap"><label>Delivery address</label><textarea id="cAddr" autocomplete="street-address"></textarea></div>
      <div class="row"><span>Subtotal</span><span>${money(sub)}</span></div>
      <div class="row"><span>Delivery</span><span id="delAmt"></span></div>
      <div class="row total"><span>Total</span><span id="tot"></span></div>
      <button class="btn btn-wa" style="width:100%" id="checkout">Order on WhatsApp</button>
      <p class="note">We confirm stock and payment details with you on WhatsApp.</p>`;
    const sel = $("#del");
    try { sel.value = localStorage.getItem("inmotion_del") || "0"; } catch (e) {}
    const upd = () => {
      const d = del[sel.value] || { price: 0 };
      const fee = S.freeDeliveryOver && sub >= S.freeDeliveryOver ? 0 : d.price || 0;
      $("#delAmt").textContent = fee ? money(fee) : "Free";
      $("#tot").textContent = money(sub + fee);
      $("#addrWrap").style.display = fee || d.price ? "" : "none";
      try { localStorage.setItem("inmotion_del", sel.value); } catch (e) {}
      return { d, fee };
    };
    sel.onchange = upd; upd();
    $("#checkout").onclick = () => {
      const { d, fee } = upd();
      const name = $("#cName").value.trim();
      if (!name) { $("#cName").focus(); toast("Please add your name"); return; }
      const msg = [`Hi In Motion, I'd like to order:`, ``,
        ...lines().map(l => `• ${l.qty} x ${l.p.name}${l.p.colour ? " (" + l.p.colour + ")" : ""}${l.size && !/one size/i.test(l.size) ? " size " + l.size : ""} = ${money(l.p.price * l.qty)}`),
        ``, `Subtotal: ${money(sub)}`, `Delivery: ${d.label} ${fee ? money(fee) : "(free)"}`, `Total: ${money(sub + fee)}`, ``,
        `Name: ${name}`, $("#addrWrap").style.display === "none" ? "" : `Address: ${$("#cAddr").value.trim()}`].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
      window.open(waLink(msg), "_blank");
    };
  }
  document.addEventListener("click", e => {
    const q = e.target.closest("[data-q]"), r = e.target.closest("[data-r]"), a = e.target.closest("[data-add]");
    if (q) { const l = cart[q.dataset.q]; l.qty += +q.dataset.d; if (l.qty < 1) cart.splice(q.dataset.q, 1); saveCart(); }
    if (r) { cart.splice(r.dataset.r, 1); saveCart(); }
    if (a) {
      e.preventDefault();
      const p = find(a.dataset.add);
      if (p.sizes.length > 1) location.href = "product.html?id=" + encodeURIComponent(p.id);
      else addToCart(p.id, p.sizes[0] || "");
    }
  });

  /* ---------- product cards ---------- */
  function card(p) {
    const badge = !p.inStock ? `<span class="badge out">Sold out</span>` : p.was ? `<span class="badge sale">Sale</span>` : p.tag ? `<span class="badge">${esc(p.tag)}</span>` : "";
    const url = "product.html?id=" + encodeURIComponent(p.id);
    return `<article class="card">
      <div class="phwrap"><a class="ph" href="${url}">${badge}<img src="${esc(p.images[0] || "images/logo.svg")}" alt="${esc(p.name)}" loading="lazy">${p.images[1] ? `<img class="alt" src="${esc(p.images[1])}" alt="" loading="lazy">` : ""}</a>
      ${p.inStock ? `<div class="quick"><button class="btn" data-add="${esc(p.id)}">${p.sizes.length > 1 ? "Choose size" : "Add to bag"}</button></div>` : ""}</div>
      <a class="meta" href="${url}"><h3>${esc(p.name)}</h3><div class="sub">${esc([p.colour, p.gender !== "Unisex" ? p.gender : ""].filter(Boolean).join(" · "))}</div>
      <div class="price">${p.was ? `<span class="now">${money(p.price)}</span><s>${money(p.was)}</s>` : money(p.price)}</div></a></article>`;
  }

  /* ---------- pages ---------- */
  const pages = {
    home() {
      const feat = PRODUCTS.filter(p => p.featured);
      $("#newArrivals").innerHTML = (feat.length ? feat : PRODUCTS).slice(0, 4).map(card).join("");
      const rest = PRODUCTS.filter(p => !feat.slice(0, 4).includes(p));
      $("#essentials").innerHTML = (rest.length ? rest : PRODUCTS).slice(0, 4).map(card).join("");
      if (!PRODUCTS.length) $("#newArrivals").innerHTML = `<p class="msg">Products coming soon.</p>`;
    },
    shop() {
      const u = new URLSearchParams(location.search);
      let cat = u.get("c") || "All", g = u.get("g") || "", sort = "featured";
      const cats = ["All", ...new Set(PRODUCTS.map(p => p.category))];
      if (g) $("#shopTitle").textContent = g;
      else if (cat !== "All") $("#shopTitle").textContent = cat;
      const draw = () => {
        $("#chips").innerHTML = cats.map(c => `<button class="chip ${c === cat ? "on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
        let list = PRODUCTS.filter(p => (cat === "All" || p.category === cat) && (!g || p.gender === g || p.gender === "Unisex"));
        if (sort === "low") list = [...list].sort((a, b) => a.price - b.price);
        if (sort === "high") list = [...list].sort((a, b) => b.price - a.price);
        $("#shopGrid").innerHTML = list.length ? list.map(card).join("") : `<p class="msg" style="grid-column:1/-1">Nothing here yet. New drops coming soon.</p>`;
        $("#shopCount").textContent = list.length + (list.length === 1 ? " product" : " products");
      };
      $("#chips").onclick = e => { const b = e.target.closest("[data-c]"); if (b) { cat = b.dataset.c; draw(); } };
      $("#sort").onchange = e => { sort = e.target.value; draw(); };
      draw();
    },
    product() {
      const p = find(new URLSearchParams(location.search).get("id"));
      const root = $("#pdp");
      if (!p) { root.innerHTML = `<div class="msg">Product not found. <a href="shop.html" style="text-decoration:underline">Back to shop</a></div>`; return; }
      document.title = p.name + " | " + S.name;
      let size = p.sizes.length === 1 ? p.sizes[0] : "", qty = 1;
      root.innerHTML = `<div class="crumbs"><a href="shop.html">Shop</a> / <a href="shop.html?c=${encodeURIComponent(p.category)}">${esc(p.category)}</a></div>
        <div class="pdp">
          <div class="gallery"><div class="main"><img id="mainImg" src="${esc(p.images[0] || "images/logo.svg")}" alt="${esc(p.name)}"></div>
            ${p.images.length > 1 ? `<div class="thumbs">${p.images.map((s, i) => `<button class="${i ? "" : "on"}" data-img="${esc(s)}"><img src="${esc(s)}" alt=""></button>`).join("")}</div>` : ""}</div>
          <div class="info">
            ${p.tag ? `<div class="eyebrow">${esc(p.tag)}</div>` : ""}
            <h1>${esc(p.name)}</h1>
            <div class="price">${p.was ? `<span class="now">${money(p.price)}</span><s>${money(p.was)}</s>` : money(p.price)}</div>
            <p class="desc">${esc(p.description)}</p>
            ${p.colour ? `<div class="opt-label">Colour: <b style="color:var(--ink)">${esc(p.colour)}</b></div>` : ""}
            ${p.sizes.length ? `<div class="opt-label" style="margin-top:16px">Size</div><div class="sizes">${p.sizes.map(s => `<button class="size ${s === size ? "on" : ""}" data-size="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}
            <div class="buy"><div class="qty"><button id="qm" aria-label="Less">−</button><span id="qv">1</span><button id="qp" aria-label="More">+</button></div>
              <button class="btn btn-dark" id="add" ${p.inStock ? "" : "disabled"}>${p.inStock ? "Add to bag" : "Sold out"}</button></div>
            <a class="btn btn-wa" style="width:100%" target="_blank" rel="noopener" href="${waLink(`Hi In Motion, I have a question about the ${p.name}.`)}">Ask us on WhatsApp</a>
            <div class="perks"><div><b>Delivery:</b> collect in Cape Town or courier anywhere in South Africa.</div><div><b>Free delivery</b> on orders over ${money(S.freeDeliveryOver || 0)}.</div><div><b>Wrong size?</b> Message us and we will sort it out.</div></div>
          </div></div>
        <section class="block" style="padding-top:20px"><div class="sec-head"><h2>You may also like</h2><a href="shop.html">View all</a></div>
          <div class="grid">${PRODUCTS.filter(x => x.id !== p.id).slice(0, 4).map(card).join("")}</div></section>`;
      root.onclick = e => {
        const t = e.target.closest("[data-img]"), s = e.target.closest("[data-size]");
        if (t) { $("#mainImg").src = t.dataset.img; $$(".thumbs button").forEach(b => b.classList.toggle("on", b === t)); }
        if (s) { size = s.dataset.size; $$(".size").forEach(b => b.classList.toggle("on", b === s)); }
      };
      $("#qm").onclick = () => { qty = Math.max(1, qty - 1); $("#qv").textContent = qty; };
      $("#qp").onclick = () => { qty++; $("#qv").textContent = qty; };
      $("#add").onclick = () => {
        if (p.sizes.length && !size) { toast("Please choose a size"); return; }
        addToCart(p.id, size, qty);
      };
    }
  };

  layout();
  renderCart();
  loadProducts().then(list => {
    PRODUCTS = list;
    cart = cart.filter(l => find(l.id));
    renderCart();
    const page = document.body.dataset.page;
    if (pages[page]) pages[page]();
  });
})();
