/* Tangled with Love — navigation, discovery, personalization, cart, and checkout. */
/* =====================================================================
   STATE
   ===================================================================== */
const STATE = {
  cart: [],            // [{ lineId, variantId, categoryId, name, price, qty, colour, size, message, img }]
  detail: null,        // currently-open variant
  detailQty: 1,
  lightboxImages: [],
  lightboxIdx: 0,
  currentCategoryId: null,
  wishlist: [],
  recentlyViewed: [],
  searchCategory: "all",
  searchSavedOnly: false,
  finder: { size: "", budget: "", style: "" },
  modalReturnFocus: null,
  toastTimer: null,
};

let emailJsPromise = null;

function loadEmailJs() {
  if (!CONFIG.EMAILJS_PUBLIC_KEY) return Promise.resolve(null);
  if (globalThis.emailjs) {
    globalThis.emailjs.init({ publicKey: CONFIG.EMAILJS_PUBLIC_KEY });
    return Promise.resolve(globalThis.emailjs);
  }
  if (emailJsPromise) return emailJsPromise;
  emailJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    script.async = true;
    script.onload = () => {
      globalThis.emailjs.init({ publicKey: CONFIG.EMAILJS_PUBLIC_KEY });
      resolve(globalThis.emailjs);
    };
    script.onerror = () => reject(new Error("Email service could not be loaded"));
    document.head.append(script);
  });
  return emailJsPromise;
}

/* =====================================================================
   HELPERS
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const fmt = (n) => CONFIG.CURRENCY_SYMBOL + n.toFixed(2);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const findVariant = (catId, vId) => {
  const cat = CATEGORIES.find(c => c.id === catId);
  return cat ? cat.variants.find(v => v.id === vId) : null;
};
const findCategory = (catId) => CATEGORIES.find(c => c.id === catId);
const categoryPriceText = (cat) => {
  if (cat.bundleQty && cat.bundlePrice) return `${cat.bundleQty} for ${fmt(cat.bundlePrice)}`;
  if (!cat.variants.length) return "Coming soon";
  const prices = cat.variants.map(v => v.price);
  const lowestPrice = Math.min(...prices);
  return prices.every(price => price === lowestPrice) ? fmt(lowestPrice) : `From ${fmt(lowestPrice)}`;
};

function variantImage(catId, vId, index=0) {
  const key = `${catId}/${vId}`;
  const files = IMAGE_MAP[key] || [];
  return files[index] ? `assets/products/${key}/${files[index]}` : "";
}

// Returns the designated hero image for a variant (uses its heroIdx, falls back to 0)
function variantHeroImage(cat, v) {
  const idx = Math.min(v.heroIdx || 0, (IMAGE_MAP[`${cat.id}/${v.id}`] || []).length - 1);
  return variantImage(cat.id, v.id, Math.max(0, idx));
}

// Lightweight WebP previews keep browsing fast; product galleries still use originals.
function variantCardImage(cat, v) {
  return `assets/thumbs/${cat.id}/${v.id}.webp`;
}

// Returns the full list of images for a variant, with the hero image moved to position 0.
// Only returns images that actually exist in IMAGE_MAP.
function allVariantImages(catId, vId, heroIdx=0) {
  const key = `${catId}/${vId}`;
  const files = IMAGE_MAP[key] || [];
  if (files.length === 0) return [];
  const reordered = heroIdx > 0 && heroIdx < files.length
    ? [files[heroIdx], ...files.filter((_, i) => i !== heroIdx)]
    : files;
  return reordered.map(f => `assets/products/${key}/${f}`);
}

function photoCountBadge(catId, vId) {
  const count = (IMAGE_MAP[`${catId}/${vId}`] || []).length;
  if (count < 2) return "";
  return `<span class="photo-count-badge" aria-label="${count} product photos">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h3l1.4-2h7.2l1.4 2h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>
    ${count}
  </span>`;
}

function cardPeekLabel() {
  return `<span class="card-peek" aria-hidden="true">Peek inside <span>↗</span></span>`;
}

const HEART_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>`;
const productKey = (catId, vId) => `${catId}::${vId}`;

function handleRouteLink(event, navigate) {
  const plainClick = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  if (!plainClick || event.defaultPrevented) return true;
  event.preventDefault();
  navigate();
  return false;
}

function navigateHomeLink(event) {
  return handleRouteLink(event, goHome);
}

function navigateSectionLink(event, anchor) {
  return handleRouteLink(event, () => navTo(anchor));
}

function navigateCategoryLink(event, catId) {
  return handleRouteLink(event, () => openCategory(catId));
}

function navigateProductLink(event, catId, vId, context="") {
  return handleRouteLink(event, () => {
    if (context === "search") closeSearch(null, false);
    if (context === "finder") closeFinder(null, false);
    openDetail(catId, vId);
  });
}

function rememberModalFocus() {
  if (document.activeElement instanceof HTMLElement) STATE.modalReturnFocus = document.activeElement;
}

function restoreModalFocus() {
  const target = STATE.modalReturnFocus;
  STATE.modalReturnFocus = null;
  if (target && target.isConnected) requestAnimationFrame(() => target.focus());
}

function allProducts() {
  return CATEGORIES.flatMap(cat => cat.variants.map(variant => ({ cat, variant, key: productKey(cat.id, variant.id) })));
}

function loadPersonalization() {
  const validKeys = new Set(allProducts().map(item => item.key));
  try {
    const saved = JSON.parse(localStorage.getItem("twl_wishlist") || "[]");
    STATE.wishlist = Array.isArray(saved) ? saved.filter(key => validKeys.has(key)) : [];
  } catch (e) { STATE.wishlist = []; }
  try {
    const viewed = JSON.parse(localStorage.getItem("twl_recently_viewed") || "[]");
    STATE.recentlyViewed = Array.isArray(viewed) ? viewed.filter(key => validKeys.has(key)).slice(0, 8) : [];
  } catch (e) { STATE.recentlyViewed = []; }
  try {
    const finder = JSON.parse(localStorage.getItem("twl_finder") || "{}");
    const allowed = { size: ["essentials","everyday","roomy"], budget: ["under25","25to35","40plus"], style: ["floral","bright","earthy"] };
    Object.keys(allowed).forEach(key => { if (allowed[key].includes(finder[key])) STATE.finder[key] = finder[key]; });
  } catch (e) {}
}

function isWishlisted(catId, vId) {
  return STATE.wishlist.includes(productKey(catId, vId));
}

function wishlistButton(catId, vId) {
  const active = isWishlisted(catId, vId);
  const name = findVariant(catId, vId)?.name || "product";
  return `<button type="button" class="wishlist-btn ${active ? "active" : ""}" data-wishlist-key="${productKey(catId, vId)}" onclick="toggleWishlist('${catId}','${vId}',event)" aria-label="${active ? "Remove" : "Save"} ${name}" aria-pressed="${active}">${HEART_ICON}<span class="wishlist-sparkles" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>`;
}

function updateWishlistUI() {
  $("wishlistCount").textContent = STATE.wishlist.length ? String(STATE.wishlist.length) : "";
  document.querySelectorAll("[data-wishlist-key]").forEach(button => {
    const active = STATE.wishlist.includes(button.dataset.wishlistKey);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    const currentLabel = button.getAttribute("aria-label") || "product";
    button.setAttribute("aria-label", currentLabel.replace(/^(Save|Remove)/, active ? "Remove" : "Save"));
  });
  if (STATE.detail) {
    const active = isWishlisted(STATE.detail.catId, STATE.detail.vId);
    $("detailSaveBtn").classList.toggle("active", active);
    $("detailSaveBtn").setAttribute("aria-pressed", String(active));
    $("detailSaveBtn").setAttribute("aria-label", active ? "Remove this product from saved items" : "Save this product");
  }
}

function toggleWishlist(catId, vId, event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  const sourceButton = event?.currentTarget || null;
  const key = productKey(catId, vId);
  const name = findVariant(catId, vId)?.name || "Product";
  const index = STATE.wishlist.indexOf(key);
  if (index >= 0) {
    STATE.wishlist.splice(index, 1);
    showToast(`${name} removed from saved pieces`, "♡");
  } else {
    STATE.wishlist.unshift(key);
    showToast(`${name} saved for later`, "♥");
    if (sourceButton) {
      sourceButton.classList.remove("celebrate");
      void sourceButton.offsetWidth;
      sourceButton.classList.add("celebrate");
      setTimeout(() => sourceButton.classList.remove("celebrate"), 700);
    }
  }
  localStorage.setItem("twl_wishlist", JSON.stringify(STATE.wishlist));
  updateWishlistUI();
  if ($("searchOverlay").classList.contains("open")) renderSearchResults();
}

function toggleDetailWishlist() {
  if (!STATE.detail) return;
  toggleWishlist(STATE.detail.catId, STATE.detail.vId);
}

function rememberViewed(catId, vId) {
  const key = productKey(catId, vId);
  STATE.recentlyViewed = [key, ...STATE.recentlyViewed.filter(item => item !== key)].slice(0, 8);
  localStorage.setItem("twl_recently_viewed", JSON.stringify(STATE.recentlyViewed));
  renderRecentlyViewed();
}

function productFromKey(key) {
  return allProducts().find(item => item.key === key) || null;
}

function renderRecentlyViewed() {
  const items = STATE.recentlyViewed.map(productFromKey).filter(Boolean).slice(0, 4);
  $("recentSection").hidden = items.length === 0;
  $("recentGrid").innerHTML = items.map(({ cat, variant }) => `
    <article class="recent-card">
      <div class="recent-card-img"><img src="${variantCardImage(cat, variant)}" data-fallback="${variantHeroImage(cat, variant)}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${variant.name}" loading="lazy" decoding="async">${wishlistButton(cat.id, variant.id)}${cardPeekLabel()}</div>
      <a class="recent-card-body card-route-link" href="${routeHref(productRoutePath(variant.id))}" onclick="return navigateProductLink(event,'${cat.id}','${variant.id}')"><div class="recent-card-category">${cat.name}</div><div class="recent-card-name">${variant.name}</div><div class="recent-card-price">${fmt(variant.price)}</div></a>
    </article>`).join("");
}

function showToast(message, icon="✓") {
  clearTimeout(STATE.toastTimer);
  $("toastMessage").textContent = message;
  $("toastIcon").textContent = icon;
  $("toast").classList.remove("pop");
  void $("toast").offsetWidth;
  $("toast").classList.add("show");
  $("toast").classList.add("pop");
  STATE.toastTimer = setTimeout(() => $("toast").classList.remove("show", "pop"), 2600);
}

function renderSearchFilters() {
  const filters = [{ id: "all", name: "All pieces" }, ...CATEGORIES.filter(cat => cat.variants.length).map(cat => ({ id: cat.id, name: cat.name }))];
  $("searchFilters").innerHTML = filters.map(filter => `<button type="button" class="search-chip ${STATE.searchCategory === filter.id ? "active" : ""}" onclick="setSearchCategory('${filter.id}')">${filter.name}</button>`).join("");
}

function setSearchCategory(catId) {
  STATE.searchCategory = catId;
  STATE.searchSavedOnly = false;
  renderSearchFilters();
  renderSearchResults();
}

function renderSearchResults() {
  const query = $("productSearch").value.trim().toLowerCase();
  const budget = $("searchBudget").value;
  const sort = $("searchSort").value;
  let products = allProducts().filter(({ cat, variant, key }) => {
    if (STATE.searchSavedOnly && !STATE.wishlist.includes(key)) return false;
    if (STATE.searchCategory !== "all" && cat.id !== STATE.searchCategory) return false;
    if (!priceMatchesBudget(variant.price, budget)) return false;
    if (!query) return true;
    return `${variant.name} ${variant.desc} ${cat.name} ${cat.tagline}`.toLowerCase().includes(query);
  });
  if (sort === "price-low") products.sort((a, b) => a.variant.price - b.variant.price);
  else if (sort === "price-high") products.sort((a, b) => b.variant.price - a.variant.price);
  else if (sort === "name") products.sort((a, b) => a.variant.name.localeCompare(b.variant.name));
  else if (query) products.sort((a, b) => Number(b.variant.name.toLowerCase().startsWith(query)) - Number(a.variant.name.toLowerCase().startsWith(query)));
  $("searchCount").textContent = `${products.length} ${products.length === 1 ? "piece" : "pieces"}`;
  $("searchResults").innerHTML = products.length ? products.map(({ cat, variant }) => `
    <article class="search-result">
      <div class="search-result-img"><img src="${variantCardImage(cat, variant)}" data-fallback="${variantHeroImage(cat, variant)}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${variant.name}" loading="lazy" decoding="async">${wishlistButton(cat.id, variant.id)}${cardPeekLabel()}</div>
      <a class="search-result-body card-route-link" href="${routeHref(productRoutePath(variant.id))}" onclick="return navigateProductLink(event,'${cat.id}','${variant.id}','search')"><div class="search-result-cat">${cat.name}</div><div class="search-result-name">${variant.name}</div><div class="search-result-price">${fmt(variant.price)}</div></a>
    </article>`).join("") : `<div class="search-empty"><div class="search-empty-icon">🧶</div><strong>${STATE.searchSavedOnly ? "No saved pieces yet" : "No pieces found"}</strong><span>${STATE.searchSavedOnly ? "Tap the heart on any product to keep it here." : "Try another colour, style, or category."}</span></div>`;
}

function priceMatchesBudget(price, budget) {
  if (budget === "under25") return price < 25;
  if (budget === "25to35") return price >= 25 && price <= 35;
  if (budget === "40plus") return price >= 40;
  return true;
}

function clearSearchFilters() {
  STATE.searchCategory = "all";
  STATE.searchSavedOnly = false;
  $("productSearch").value = "";
  $("searchBudget").value = "all";
  $("searchSort").value = "featured";
  renderSearchFilters();
  renderSearchResults();
  $("productSearch").focus();
}

function openSearch(savedOnly=false) {
  closeNavMenu();
  closeCart(false);
  closeFinder(null, false);
  rememberModalFocus();
  STATE.searchSavedOnly = Boolean(savedOnly);
  STATE.searchCategory = "all";
  $("productSearch").value = "";
  $("searchBudget").value = "all";
  $("searchSort").value = "featured";
  $("productSearch").placeholder = savedOnly ? "Search your saved pieces…" : "Search by style, colour, or product…";
  renderSearchFilters();
  renderSearchResults();
  $("searchOverlay").classList.add("open");
  $("searchOverlay").setAttribute("aria-hidden", "false");
  document.body.classList.add("search-open");
  setTimeout(() => $("productSearch").focus(), 300);
}

function closeSearch(event, restoreFocus=true) {
  if (event && event.target !== $("searchOverlay")) return;
  $("searchOverlay").classList.remove("open");
  $("searchOverlay").setAttribute("aria-hidden", "true");
  document.body.classList.remove("search-open");
  if (restoreFocus) restoreModalFocus();
}

function chooseFinderOption(group, value, button) {
  STATE.finder[group] = value;
  document.querySelectorAll(`[data-finder-group="${group}"] .finder-option`).forEach(option => {
    const active = option === button;
    option.classList.toggle("active", active);
    option.setAttribute("aria-pressed", String(active));
  });
  $("finderSubmit").disabled = !Object.values(STATE.finder).every(Boolean);
  $("finderResults").classList.remove("show");
}

function syncFinderUI() {
  document.querySelectorAll("[data-finder-group]").forEach(group => {
    const key = group.dataset.finderGroup;
    group.querySelectorAll(".finder-option").forEach(option => {
      const active = option.dataset.value === STATE.finder[key];
      option.classList.toggle("active", active);
      option.setAttribute("aria-pressed", String(active));
    });
  });
  $("finderSubmit").disabled = !Object.values(STATE.finder).every(Boolean);
}

function openFinder() {
  closeNavMenu();
  closeCart(false);
  closeSearch(null, false);
  rememberModalFocus();
  syncFinderUI();
  $("finderResults").classList.remove("show");
  $("finderOverlay").classList.add("open");
  $("finderOverlay").setAttribute("aria-hidden", "false");
  document.body.classList.add("finder-open");
  setTimeout(() => $("finderOverlay").querySelector(".finder-close").focus(), 320);
}

function closeFinder(event, restoreFocus=true) {
  if (event && event.target !== $("finderOverlay")) return;
  $("finderOverlay").classList.remove("open");
  $("finderOverlay").setAttribute("aria-hidden", "true");
  document.body.classList.remove("finder-open");
  if (restoreFocus) restoreModalFocus();
}

function finderStyleMatch(product, style) {
  const copy = `${product.variant.name} ${product.variant.desc} ${product.cat.name}`.toLowerCase();
  const patterns = {
    floral: /flower|floral|daisy|rose|blossom|bloom|garden|sunflower|meadow/,
    bright: /ruby|sky|lavender|strawberry|golden|sunshine|blue|berry|pink/,
    earthy: /mocha|sage|forest|terracotta|autumn|espresso|rosewood|oat|brown|cream/,
  };
  return patterns[style]?.test(copy) || false;
}

function runFinder() {
  if (!Object.values(STATE.finder).every(Boolean)) return;
  const sizeCategories = {
    essentials: ["xs-bags","small-potli"],
    everyday: ["small-bags","medium-bags/round","medium-bags/rectangle","round-patches"],
    roomy: ["large-sized-bag","leather-bags","round-patches","medium-bags/rectangle"],
  };
  const matches = allProducts()
    .filter(item => priceMatchesBudget(item.variant.price, STATE.finder.budget))
    .map(item => ({
      ...item,
      score: (sizeCategories[STATE.finder.size].includes(item.cat.id) ? 5 : 0) + (finderStyleMatch(item, STATE.finder.style) ? 3 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.variant.price - b.variant.price || a.variant.name.localeCompare(b.variant.name))
    .slice(0, 3);
  localStorage.setItem("twl_finder", JSON.stringify(STATE.finder));
  $("finderResultsGrid").innerHTML = matches.map(({ cat, variant }) => `
    <a class="finder-result" href="${routeHref(productRoutePath(variant.id))}" onclick="return navigateProductLink(event,'${cat.id}','${variant.id}','finder')">
      <img src="${variantCardImage(cat, variant)}" data-fallback="${variantHeroImage(cat, variant)}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${variant.name}" loading="lazy" decoding="async">
      <div class="finder-result-copy"><small>${cat.name}</small><strong>${variant.name}</strong><span>${fmt(variant.price)}</span></div>
    </a>`).join("");
  $("finderResults").classList.add("show");
  $("finderResults").scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" });
}

function setupRevealAnimations() {
  const targets = document.querySelectorAll(".trust-item,.cat-card,.custom-banner,.about-visual,.about-text,.testi-card,.faq-item,.contact-info,.contact-form-panel");
  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    targets.forEach(el => el.classList.add("revealed"));
    return;
  }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add("revealed"); observer.unobserve(entry.target); }
  }), { threshold: 0.08, rootMargin: "0px 0px -30px" });
  targets.forEach((el, index) => { el.dataset.reveal = ""; el.style.transitionDelay = `${Math.min(index % 4, 3) * 55}ms`; observer.observe(el); });
}

/* =====================================================================
   NAV / PAGE ROUTING
   ===================================================================== */
const NAV_SECTION_IDS = ["shop", "about", "testimonials", "faq", "contact"];
let navFramePending = false;

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setActiveNav(sectionId) {
  document.querySelectorAll("[data-nav-section]").forEach(link => {
    const isActive = link.dataset.navSection === sectionId;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function closeNavMenu() {
  const nav = $("siteNav");
  const toggle = $("navToggle");
  const backdrop = $("navBackdrop");
  if (!nav || !toggle || !backdrop) return;
  nav.classList.remove("menu-open");
  backdrop.classList.remove("open");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open menu");
}

function toggleNavMenu() {
  const nav = $("siteNav");
  const isOpen = nav && nav.classList.toggle("menu-open");
  $("navBackdrop").classList.toggle("open", Boolean(isOpen));
  $("navToggle").setAttribute("aria-expanded", String(Boolean(isOpen)));
  $("navToggle").setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
}

function syncNavigationState() {
  navFramePending = false;
  const nav = $("siteNav");
  const homeActive = $("page-home").classList.contains("active");
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
  $("navProgressFill").style.transform = `scaleX(${progress})`;
  nav.classList.toggle("is-scrolled", window.scrollY > 10);
  $("backToTop").classList.toggle("visible", window.scrollY > 520);

  if (!homeActive) {
    const pageId = document.querySelector(".page.active")?.id || "";
    setActiveNav(["page-categories", "page-variants", "page-detail"].includes(pageId) ? "shop" : null);
    return;
  }

  const marker = window.scrollY + nav.offsetHeight + Math.min(180, window.innerHeight * 0.28);
  let activeSection = null;
  NAV_SECTION_IDS.forEach(id => {
    const section = $(id);
    if (section && section.offsetTop <= marker) activeSection = id;
  });
  setActiveNav(activeSection);
}

function scheduleNavigationSync() {
  if (navFramePending) return;
  navFramePending = true;
  requestAnimationFrame(syncNavigationState);
}

const SECTION_PATHS = {
  shop: "/shop",
  about: "/about",
  testimonials: "/reviews",
  faq: "/faq",
  contact: "/contacts",
};
const SECTION_TITLES = { shop: "Shop Handmade Crochet Bags", about: "Our Story", testimonials: "Customer Reviews", faq: "Frequently Asked Questions", contact: "Contact Tangled with Love" };

function normalizeRoutePath(pathname=location.pathname) {
  const decoded = decodeURIComponent(pathname || "/");
  if (decoded === "/") return "/";
  return decoded.replace(/\/+$/, "") || "/";
}

function currentRoutePath() {
  const localPath = location.protocol === "file:"
    ? new URLSearchParams(location.search).get("__path") || "/"
    : location.pathname;
  return normalizeRoutePath(localPath);
}

function routeHref(path) {
  if (location.protocol !== "file:") return path;
  const target = new URL(location.href);
  target.search = "";
  target.hash = "";
  if (path !== "/") target.searchParams.set("__path", path);
  return target.href;
}

function updateLocalRouteLinks(root=document) {
  if (location.protocol !== "file:") return;
  root.querySelectorAll('a[href^="/"]').forEach(link => {
    const path = link.getAttribute("href");
    if (path) link.href = routeHref(path);
  });
}

function categoryRoutePath(catId) { return `/collections/${slug(catId)}`; }
function productRoutePath(vId) { return `/products/${slug(vId)}`; }

function pathForRoute(route) {
  if (!route || route.id === "home") return route?.anchor ? SECTION_PATHS[route.anchor] || "/" : "/";
  if (route.id === "categories") return "/collections";
  if (route.id === "variants" && route.catId) return categoryRoutePath(route.catId);
  if (route.id === "detail" && route.vId) return productRoutePath(route.vId);
  if (route.id === "success") return "/checkout/success";
  if (route.id === "cancel") return "/checkout/cancel";
  if (route.id === "custom-welcome") return "/custom-order";
  return "/";
}

function routeFromLocation() {
  const path = currentRoutePath();
  if (path === "/") return { id: "home" };
  const section = Object.entries(SECTION_PATHS).find(([, sectionPath]) => sectionPath === path);
  if (section) return { id: "home", anchor: section[0] };
  if (path === "/contact") return { id: "home", anchor: "contact" }; // legacy alias
  if (path === "/collections") return { id: "categories" };
  if (path.startsWith("/collections/")) {
    const segment = path.slice("/collections/".length);
    const cat = CATEGORIES.find(item => slug(item.id) === segment);
    if (cat) return { id: "variants", catId: cat.id };
  }
  if (path.startsWith("/products/")) {
    const segment = path.slice("/products/".length);
    const product = allProducts().find(item => slug(item.variant.id) === segment);
    if (product) return { id: "detail", catId: product.cat.id, vId: product.variant.id };
  }
  if (path === "/checkout/success") return { id: "success" };
  if (path === "/checkout/cancel") return { id: "cancel" };
  if (path === "/custom-order") return { id: "custom-welcome" };
  return { id: "home", notFound: true };
}

function updateCanonicalPath(path) {
  const canonical = $("canonicalUrl");
  if (canonical) canonical.href = `https://tangledwithlove.com${path === "/" ? "/" : path}`;
}

function setBrowserRoute(route, replace=false) {
  const path = pathForRoute(route);
  const hasNonRouteQuery = location.protocol !== "file:" && Boolean(location.search);
  const samePath = currentRoutePath() === path && !hasNonRouteQuery && !location.hash;
  const method = replace || samePath ? "replaceState" : "pushState";
  history[method](null, "", routeHref(path));
  updateCanonicalPath(path);
}

function renderLocationRoute(scrollBehavior="auto") {
  const target = routeFromLocation();
  closeNavMenu();
  closeSearch(null, false);
  closeFinder(null, false);
  closeCart(false);
  if (target.id === "categories") {
    renderCategoriesPage();
    showPage("categories", false);
  } else if (target.id === "variants" && target.catId) {
    openCategory(target.catId, false);
  } else if (target.id === "detail" && target.catId && target.vId) {
    openDetail(target.catId, target.vId, false);
  } else {
    showPage(target.id || "home", false);
    if (target.id === "custom-welcome") activateCustomWelcome();
  }
  if (target.id === "home" && target.anchor) {
    document.title = `${SECTION_TITLES[target.anchor] || "Tangled with Love"} — Tangled with Love`;
  }
  if (target.notFound) setBrowserRoute({ id: "home" }, true);
  else updateCanonicalPath(pathForRoute(target));

  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (target.id === "home" && target.anchor && $(target.anchor)) {
      $(target.anchor).scrollIntoView({ behavior: scrollBehavior, block: "start" });
      setActiveNav(target.anchor);
    } else {
      window.scrollTo({ top: 0, behavior: scrollBehavior });
    }
    syncNavigationState();
  }));
}

function showPage(id, push=true, routeData={}) {
  const el = document.getElementById("page-" + id);
  if (!el) return;
  if (id === "home") document.title = "Tangled with Love — Handcrafted Crochet Bags";
  else if (id === "categories") document.title = "Shop Handmade Crochet Bags — Tangled with Love";
  closeNavMenu();
  const activePage = document.querySelector(".page.active");
  const activatePage = () => {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    el.classList.add("active");
  };
  if (activePage && activePage !== el && document.startViewTransition && !prefersReducedMotion()) {
    document.startViewTransition(activatePage);
  } else {
    activatePage();
  }
  window.scrollTo({ top: 0, behavior: "auto" });
  if (push) setBrowserRoute({ id, ...routeData });
  requestAnimationFrame(syncNavigationState);
}

function goHome() {
  closeNavMenu();
  showPage("home", false);
  setBrowserRoute({ id: "home" });
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  setActiveNav(null);
}

function navTo(anchor) {
  closeNavMenu();
  if (!$("page-home").classList.contains("active")) showPage("home", false);
  setBrowserRoute({ id: "home", anchor });
  document.title = `${SECTION_TITLES[anchor] || "Tangled with Love"} — Tangled with Love`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.getElementById(anchor);
    if (el) el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    setActiveNav(anchor);
  }));
}

function trapOpenDialog(event) {
  if (event.key !== "Tab") return false;
  const container = $("finderOverlay").classList.contains("open") ? $("finderOverlay").querySelector(".finder-panel")
    : $("searchOverlay").classList.contains("open") ? $("searchOverlay").querySelector(".search-panel")
    : $("imageLightbox").classList.contains("open") ? $("imageLightbox")
    : $("cartDrawer").classList.contains("open") ? $("cartDrawer") : null;
  if (!container) return false;
  const focusable = Array.from(container.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
    .filter(element => !element.hidden && element.getClientRects().length);
  if (!focusable.length) return false;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!container.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
  return true;
}

function scrollToTop() {
  closeNavMenu();
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function setupNavigation() {
  history.replaceState(null, "", location.href);
  history.scrollRestoration = "manual";
  updateLocalRouteLinks();
  renderLocationRoute("auto");
  window.addEventListener("popstate", () => {
    renderLocationRoute("auto");
  });
  window.addEventListener("scroll", scheduleNavigationSync, { passive: true });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 820) closeNavMenu();
    scheduleNavigationSync();
  }, { passive: true });
  document.addEventListener("keydown", event => {
    if (trapOpenDialog(event)) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.key === "Escape") {
      if ($("finderOverlay").classList.contains("open")) closeFinder();
      else if ($("searchOverlay").classList.contains("open")) closeSearch();
      else if ($("imageLightbox").classList.contains("open")) closeImageLightbox();
      else if ($("cartDrawer").classList.contains("open")) closeCart();
      else closeNavMenu();
    }
  });
  document.querySelectorAll("#navLinks a").forEach(link => link.addEventListener("click", closeNavMenu));
  syncNavigationState();
}

/* =====================================================================
   HOME — render hero cards + featured categories
   ===================================================================== */
function renderHeroCards() {
  // Show 4 hero picks: one per category, mixing styles
  const picks = [
    { cat: "round-patches", var: "cherry-blossom" },
    { cat: "medium-bags/round", var: "forest-sunflower-round" },
    { cat: "small-bags", var: "ruby-rose-crossbody" },
    { cat: "small-potli", var: "autumn-garden-potli" },
  ];
  $("heroCards").innerHTML = picks.map(p => {
    const cat = findCategory(p.cat);
    const v = findVariant(p.cat, p.var);
    if (!v || !cat) return "";
    return `
      <article class="product-card">
        <div class="product-img-wrap">
          <img src="${variantCardImage(cat, v)}" data-fallback="${variantHeroImage(cat, v)}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${v.name}" loading="eager" decoding="async" ${p === picks[0] ? 'fetchpriority="high"' : ''}>
          ${wishlistButton(p.cat, p.var)}
          ${photoCountBadge(p.cat, p.var)}
          ${cardPeekLabel()}
        </div>
        <a class="product-info card-route-link" href="${routeHref(productRoutePath(p.var))}" onclick="return navigateProductLink(event,'${p.cat}','${p.var}')">
          <div class="product-name">${v.name}</div>
          <div class="product-price">${fmt(v.price)}</div>
        </a>
      </article>`;
  }).join("");
}

function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const REVIEW_EXCERPT_LEN = 150;

function renderReviews() {
  const grid = $("testimonialsGrid");
  if (!grid) return;
  if (!REVIEWS.length) {
    grid.innerHTML = `<p class="testi-empty">Reviews are coming soon — be the first to share yours in the contact form below!</p>`;
    return;
  }
  grid.innerHTML = REVIEWS.map((r, i) => {
    const hasLongText = r.text.length > REVIEW_EXCERPT_LEN;
    const hasImages = Array.isArray(r.images) && r.images.length > 0;
    const excerpt = hasLongText ? r.text.slice(0, REVIEW_EXCERPT_LEN).trim() + "…" : r.text;
    const images = hasImages
      ? `<div class="testi-images">${r.images.map(src => `<img src="${escHtml(src)}" alt="Photo from ${escHtml(r.name)}'s review" loading="lazy">`).join("")}</div>`
      : "";
    const expandable = hasLongText || hasImages;
    return `
      <article class="testi-card" data-idx="${i}">
        ${expandable ? `<button class="testi-close" onclick="closeReview(${i}, event)" aria-label="Close review">✕</button>` : ""}
        <div class="testi-stars" role="img" aria-label="5 out of 5 stars">★★★★★</div>
        <p class="testi-quote testi-excerpt">"${escHtml(excerpt)}"</p>
        <div class="testi-author">— ${escHtml(r.name)}</div>
        ${expandable ? `<button type="button" class="testi-more" onclick="openReview(${i}, event)">${hasLongText ? "Read full review" : "View photos"} →</button>` : ""}
        <div class="testi-expand"><div class="testi-expand-inner"><div class="testi-expand-content">
          ${hasLongText ? `<p class="testi-quote">"${escHtml(r.text).replace(/\n\n/g, "\"</p><p class=\"testi-quote\">\"")}"</p>` : ""}
          ${images}
        </div></div></div>
      </article>`;
  }).join("");
}

function openReview(idx, evt) {
  if (evt) evt.stopPropagation();
  const grid = $("testimonialsGrid");
  const card = document.querySelector(`.testi-card[data-idx="${idx}"]`);
  if (!card || !grid || card.classList.contains("expanded")) return;
  grid.querySelectorAll(".testi-card.expanded").forEach(c => c.classList.remove("expanded"));
  card.classList.add("expanded");
  setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" }), 50);
}

function closeReview(idx, evt) {
  if (evt) evt.stopPropagation();
  const card = document.querySelector(`.testi-card[data-idx="${idx}"]`);
  if (card) card.classList.remove("expanded");
}

function renderCategoryRow() {
  $("categoryRow").innerHTML = CATEGORIES.map((cat, index) => {
    const variantCount = cat.variants.length;
    const heroVar = cat.variants.find(v => v.id === cat.heroVariant) || cat.variants[0];
    const heroMarkup = heroVar
      ? `<img src="${variantCardImage(cat, heroVar)}" data-fallback="${variantHeroImage(cat, heroVar)}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${cat.name}" loading="lazy" decoding="async">`
      : `<div class="category-empty-art" role="img" aria-label="${cat.name}, ${categoryPriceText(cat)}">${categoryPriceText(cat)}</div>`;
    return `
      <a class="cat-card cat-tone-${index % 4}" href="${routeHref(categoryRoutePath(cat.id))}" onclick="return navigateCategoryLink(event,'${cat.id}')">
        <div class="cat-card-top">
          ${variantCount ? '<span class="cat-tag">' + variantCount + (variantCount === 1 ? ' style' : ' styles') + '</span>' : '<span class="cat-tag">Seasonal</span>'}
          <span class="cat-swatches" aria-hidden="true"><i></i><i></i><i></i></span>
          ${heroMarkup}
        </div>
        <div class="cat-card-body">
          <div class="cat-card-name">${cat.name}</div>
          <div class="cat-card-desc">${cat.tagline}</div>
          <div class="cat-card-footer">
            <span class="cat-card-price">${categoryPriceText(cat)}</span>
            <span class="cat-card-cta">${variantCount ? 'Shop' : 'View'} →</span>
          </div>
        </div>
      </a>`;
  }).join("");
}

/* =====================================================================
   CATEGORY PAGE
   ===================================================================== */
function renderCategoriesPage() {
  $("bagCategoriesGrid").innerHTML = CATEGORIES.map((cat, index) => {
    const variantCount = cat.variants.length;
    const heroVar = cat.variants.find(v => v.id === cat.heroVariant) || cat.variants[0];
    const heroMarkup = heroVar
      ? `<img src="${variantCardImage(cat, heroVar)}" data-fallback="${variantHeroImage(cat, heroVar)}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${cat.name}" loading="lazy" decoding="async">`
      : `<div class="category-empty-art" role="img" aria-label="${cat.name}, ${categoryPriceText(cat)}">${categoryPriceText(cat)}</div>`;
    return `
      <a class="category-tile cat-tone-${index % 4}" href="${routeHref(categoryRoutePath(cat.id))}" onclick="return navigateCategoryLink(event,'${cat.id}')">
        <span class="cat-swatches" aria-hidden="true"><i></i><i></i><i></i></span>
        ${heroMarkup}
        <div class="category-label">
          <div class="category-label-title">${cat.name}</div>
          <div class="category-label-meta">${variantCount ? `${variantCount} ${variantCount === 1 ? 'style' : 'styles'} · ${categoryPriceText(cat)}` : `Seasonal collection · ${categoryPriceText(cat)}`}</div>
        </div>
      </a>`;
  }).join("");
}
function showCategories(push=true) { renderCategoriesPage(); showPage("categories", push); }

function openCategory(catId, push=true) {
  const cat = findCategory(catId);
  if (!cat) return;
  document.title = `${cat.name} — Tangled with Love`;
  STATE.currentCategoryId = catId;
  $("variantsBreadcrumb").textContent = cat.name;
  $("variantsTitle").textContent = cat.name;
  $("variantsCount").textContent = cat.variants.length ? `${cat.variants.length} ${cat.variants.length === 1 ? "design" : "designs"}` : "Seasonal preview";
  $("variantsSub").textContent = cat.blurb;
  $("variantsGrid").innerHTML = cat.variants.length
    ? cat.variants.map(v => `
      <article class="variant-card">
        <div class="variant-img-wrap">
          <img src="${variantCardImage(cat, v)}" data-fallback="${variantHeroImage(cat, v)}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${v.name}" loading="lazy" decoding="async">
          ${wishlistButton(cat.id, v.id)}
          ${photoCountBadge(cat.id, v.id)}
          ${cardPeekLabel()}
        </div>
        <a class="variant-body card-route-link" href="${routeHref(productRoutePath(v.id))}" onclick="return navigateProductLink(event,'${cat.id}','${v.id}')">
          <div class="variant-name">${v.name}</div>
          <div class="variant-price">${fmt(v.price)}</div>
        </a>
      </article>
    `).join("")
    : `<div class="empty-category">New seasonal Raakhi pieces are coming soon.<br><strong>${categoryPriceText(cat)}</strong></div>`;
  showPage("variants", push, { catId });
}

/* =====================================================================
   PRODUCT DETAIL
   ===================================================================== */
const COLOUR_OPTIONS = ["As shown", "Natural Cream", "Dusty Rose", "Sage Green", "Terracotta", "Midnight / Charcoal", "Warm Brown", "Custom (note below)"];

function openDetail(catId, vId, push=true) {
  const v = findVariant(catId, vId);
  if (!v) return;
  const cat = findCategory(catId);
  STATE.detail = { catId, vId, variant: v, category: cat };
  STATE.detailQty = 1;
  const categoryBreadcrumb = $("detailCategoryBreadcrumb");
  categoryBreadcrumb.textContent = cat.name;
  categoryBreadcrumb.href = routeHref(categoryRoutePath(cat.id));
  categoryBreadcrumb.onclick = event => navigateCategoryLink(event, cat.id);
  $("detailProductBreadcrumb").textContent = v.name;
  $("detailCategory").textContent = cat.name;
  $("detailName").textContent = v.name;
  $("detailPrice").textContent = fmt(v.price);
  $("detailDesc").textContent = v.desc;
  $("mobileBuyName").textContent = v.name;
  $("mobileBuyPrice").textContent = fmt(v.price);
  document.title = `${v.name} — Tangled with Love`;
  $("detailColour").innerHTML = COLOUR_OPTIONS.map(o => `<option>${o}</option>`).join("");
  $("detailSizeGroup").style.display = "none"; // sizing is fixed per style
  $("detailMsg").value = "";
  $("detailFiles").value = "";
  $("detailFileList").textContent = "";
  $("detailFileList").classList.remove("error");
  $("detailQtyNum").textContent = "1";
  // Gallery — hero first, with every real product image available to browse.
  const imgs = allVariantImages(catId, vId, v.heroIdx || 0);
  STATE.lightboxImages = imgs;
  STATE.lightboxIdx = 0;
  $("galleryHero").src = imgs[0] || "";
  $("galleryHero").alt = v.name;
  $("galleryHeroOpen").setAttribute("aria-label", `Enlarge ${v.name} photo 1 of ${Math.max(1, imgs.length)}`);
  $("galleryPhotoCount").hidden = imgs.length === 0;
  $("galleryPhotoCount").textContent = `1 / ${Math.max(1, imgs.length)}`;
  $("galleryPrev").hidden = imgs.length < 2;
  $("galleryNext").hidden = imgs.length < 2;

  if (imgs.length > 1) {
    $("galleryThumbs").style.display = "flex";
    $("galleryThumbs").innerHTML = imgs.map((src, i) => `
      <button type="button" class="gallery-thumbnail ${i === 0 ? 'active' : ''}" onclick="pickThumb(${i}, event)" aria-label="Show ${v.name} photo ${i+1} of ${imgs.length}" aria-pressed="${i === 0}">
        <img src="${src}" alt="${v.name} photo ${i+1}" loading="lazy">
      </button>`).join("");
  } else {
    // Only 1 image — no point showing a thumbnail strip
    $("galleryThumbs").style.display = "none";
    $("galleryThumbs").innerHTML = "";
  }

  rememberViewed(catId, vId);
  updateWishlistUI();
  renderRelatedProducts(catId, vId);
  updateProductSchema(cat, v);
  showPage("detail", push, { catId, vId });
}

function renderRelatedProducts(catId, vId) {
  const current = productFromKey(productKey(catId, vId));
  if (!current) return;
  const styleSignals = ["floral","bright","earthy"].filter(style => finderStyleMatch(current, style));
  const related = allProducts()
    .filter(item => item.key !== current.key)
    .map(item => ({
      ...item,
      score: (item.cat.id === catId ? 5 : 0)
        + (Math.abs(item.variant.price - current.variant.price) <= 5 ? 3 : Math.abs(item.variant.price - current.variant.price) <= 10 ? 1 : 0)
        + (styleSignals.some(style => finderStyleMatch(item, style)) ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score || Math.abs(a.variant.price - current.variant.price) - Math.abs(b.variant.price - current.variant.price))
    .slice(0, 3);
  $("detailRelatedGrid").innerHTML = related.map(({ cat, variant }) => `
    <article class="detail-related-card">
      <div class="detail-related-image"><img src="${variantCardImage(cat, variant)}" data-fallback="${variantHeroImage(cat, variant)}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${variant.name}" loading="lazy" decoding="async">${wishlistButton(cat.id, variant.id)}</div>
      <a class="detail-related-copy card-route-link" href="${routeHref(productRoutePath(variant.id))}" onclick="return navigateProductLink(event,'${cat.id}','${variant.id}')"><small>${cat.name}</small><strong>${variant.name}</strong><span>${fmt(variant.price)}</span></a>
    </article>`).join("");
}

function productShareUrl(catId, vId) {
  return `https://tangledwithlove.com${productRoutePath(vId)}`;
}

function updateProductSchema(cat, variant) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: variant.name,
    description: variant.desc,
    image: allVariantImages(cat.id, variant.id, variant.heroIdx || 0).map(src => new URL(src, document.baseURI).href),
    brand: { "@type": "Brand", name: "Tangled with Love" },
    category: cat.name,
    offers: {
      "@type": "Offer",
      priceCurrency: "CAD",
      price: variant.price.toFixed(2),
      availability: "https://schema.org/PreOrder",
      url: productShareUrl(cat.id, variant.id),
    },
  };
  $("productSchema").textContent = JSON.stringify(schema);
}

async function shareCurrentProduct() {
  if (!STATE.detail) return;
  const { catId, vId, variant } = STATE.detail;
  const url = productShareUrl(catId, vId);
  const shareData = { title: `${variant.name} — Tangled with Love`, text: `See this handmade ${variant.name} crochet bag.`, url };
  if (navigator.share) {
    try { await navigator.share(shareData); return; }
    catch (error) { if (error.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch (error) {
    const input = document.createElement("textarea");
    input.value = url;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  showToast("Product link copied", "↗");
}

function pickThumb(idx, ev) {
  ev && ev.stopPropagation();
  if (idx < 0 || idx >= STATE.lightboxImages.length) return;
  STATE.lightboxIdx = idx;
  $("galleryHero").src = STATE.lightboxImages[idx];
  $("galleryPhotoCount").textContent = `${idx + 1} / ${STATE.lightboxImages.length}`;
  const productName = STATE.detail ? STATE.detail.variant.name : "product";
  $("galleryHeroOpen").setAttribute("aria-label", `Enlarge ${productName} photo ${idx + 1} of ${STATE.lightboxImages.length}`);
  document.querySelectorAll("#galleryThumbs .gallery-thumbnail").forEach((el, i) => {
    const isActive = i === idx;
    el.classList.toggle("active", isActive);
    el.setAttribute("aria-pressed", String(isActive));
  });
}

function stepGallery(delta, ev) {
  ev && ev.stopPropagation();
  if (STATE.lightboxImages.length < 2) return;
  const nextIdx = (STATE.lightboxIdx + delta + STATE.lightboxImages.length) % STATE.lightboxImages.length;
  pickThumb(nextIdx);
}

function detailQty(delta) {
  STATE.detailQty = Math.max(1, STATE.detailQty + delta);
  $("detailQtyNum").textContent = STATE.detailQty;
}

function celebrateCartButton() {
  const button = document.querySelector(".cart-btn");
  if (!button) return;
  button.classList.remove("cart-bump");
  void button.offsetWidth;
  button.classList.add("cart-bump");
  setTimeout(() => button.classList.remove("cart-bump"), 700);
}

function addDetailToCart() {
  const d = STATE.detail;
  if (!d) return;
  const colour = $("detailColour").value;
  const message = $("detailMsg").value.trim();
  const fileInput = $("detailFiles");
  const fileListEl = $("detailFileList");
  if (fileInput.files.length && !validateFileSelection(fileInput, fileListEl)) {
    return;
  }
  const files = Array.from(fileInput.files || []);
  const lineId = `${d.catId}:${d.vId}:${slug(colour)}:${slug(message)}`;
  const existing = STATE.cart.find(x => x.lineId === lineId);
  if (existing) {
    existing.qty += STATE.detailQty;
    if (files.length) { ITEM_FILES[lineId] = files; existing.filesCount = files.length; }
  } else {
    if (files.length) ITEM_FILES[lineId] = files;
    STATE.cart.push({
      lineId,
      variantId: d.vId,
      categoryId: d.catId,
      name: `${d.category.name} — ${d.variant.name}`,
      price: d.variant.price,
      qty: STATE.detailQty,
      colour,
      message,
      filesCount: files.length,
      img: variantHeroImage(d.category, d.variant),
    });
  }
  fileInput.value = "";
  fileListEl.textContent = "";
  fileListEl.classList.remove("error");
  renderCart();
  saveCart();
  celebrateCartButton();
  showToast(`${d.variant.name} added to your cart`, "✓");
  openCart();
}

/* =====================================================================
   CART
   ===================================================================== */
function openCart() {
  closeNavMenu();
  closeSearch(null, false);
  closeFinder(null, false);
  rememberModalFocus();
  $("cartOverlay").classList.add("open");
  $("cartDrawer").classList.add("open");
  $("cartDrawer").setAttribute("aria-hidden", "false");
  document.body.classList.add("cart-open");
  setTimeout(() => $("cartDrawer").querySelector(".cart-close").focus(), 400);
}
function closeCart(restoreFocus=true) {
  const wasOpen = $("cartDrawer").classList.contains("open");
  $("cartOverlay").classList.remove("open");
  $("cartDrawer").classList.remove("open");
  $("cartDrawer").setAttribute("aria-hidden", "true");
  document.body.classList.remove("cart-open");
  if (restoreFocus && wasOpen) restoreModalFocus();
}
function cartSubtotal() { return STATE.cart.reduce((s,i)=>s + i.price * i.qty, 0); }
function cartCount()    { return STATE.cart.reduce((s,i)=>s + i.qty, 0); }

function renderCart() {
  $("cartCount").textContent = cartCount();
  if (STATE.cart.length === 0) {
    $("cartItems").innerHTML = `<div class="cart-empty">
      <div class="cart-empty-yarn" aria-hidden="true"><span></span></div>
      <h4>Your basket is waiting</h4>
      <p>Save a little handmade joy for later, or let us help you find the right piece.</p>
      <div class="cart-empty-actions">
        <button class="btn-primary" type="button" onclick="closeCart(false);navTo('shop')">Explore the collection</button>
        <button class="cart-empty-link" type="button" onclick="closeCart(false);openFinder()">Help me choose ✦</button>
      </div>
    </div>`;
    $("cartFooter").style.display = "none";
    return;
  }
  $("cartItems").innerHTML = STATE.cart.map((it, i) => `
    <div class="cart-item">
      <div class="cart-item-img"><img src="${it.img}" alt="${it.name}"></div>
      <div class="cart-item-info">
        <div class="cart-item-name">${it.name}</div>
        <div class="cart-item-opts">Colour: ${it.colour}${it.message ? ' · Note: "' + it.message + '"' : ''}${it.filesCount ? ' · ' + it.filesCount + ' file' + (it.filesCount > 1 ? 's' : '') + ' attached' : ''}</div>
        <div class="cart-item-price">${fmt(it.price * it.qty)}</div>
        <div class="cart-qty">
          <button class="qty-btn" onclick="updateQty(${i},-1)" aria-label="Decrease quantity of ${it.name}">−</button>
          <span class="qty-num">${it.qty}</span>
          <button class="qty-btn" onclick="updateQty(${i},1)" aria-label="Increase quantity of ${it.name}">+</button>
          <button class="cart-item-remove" onclick="removeCart(${i})" aria-label="Remove ${it.name} from cart">Remove</button>
        </div>
      </div>
    </div>`).join("");
  $("cartTotal").textContent = fmt(cartSubtotal());
  $("cartFooter").style.display = "block";
}
function updateQty(i, delta) {
  STATE.cart[i].qty += delta;
  if (STATE.cart[i].qty <= 0) { delete ITEM_FILES[STATE.cart[i].lineId]; STATE.cart.splice(i, 1); }
  renderCart(); saveCart();
}
function removeCart(i) { delete ITEM_FILES[STATE.cart[i].lineId]; STATE.cart.splice(i, 1); renderCart(); saveCart(); }

function saveCart() { try { localStorage.setItem("twl_cart", JSON.stringify(STATE.cart)); } catch(e){} }
function loadCart() {
  try {
    const raw = localStorage.getItem("twl_cart");
    if (raw) STATE.cart = JSON.parse(raw);
  } catch(e){}
}

function restoreCheckoutEmail() {
  try {
    const savedEmail = localStorage.getItem("twl_checkout_email") || "";
    if ($("checkoutEmail")) $("checkoutEmail").value = savedEmail;
  } catch (e) {}
}

function clearCheckoutEmailError() {
  const input = $("checkoutEmail");
  const error = $("checkoutEmailError");
  if (input) {
    input.classList.remove("invalid");
    input.removeAttribute("aria-invalid");
  }
  if (error) { error.textContent = ""; error.classList.remove("show"); }
  showCheckoutStatus("");
}

function showCheckoutStatus(message, type="") {
  const status = $("checkoutStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("show", Boolean(message));
  status.classList.toggle("error", type === "error");
}

function validatedCheckoutEmail() {
  const input = $("checkoutEmail");
  const error = $("checkoutEmailError");
  const email = input?.value.trim() || "";
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (valid) {
    clearCheckoutEmailError();
    try { localStorage.setItem("twl_checkout_email", email); } catch (e) {}
    return email;
  }
  if (input) {
    input.classList.add("invalid");
    input.setAttribute("aria-invalid", "true");
    input.focus();
  }
  if (error) {
    error.textContent = email ? "Please check the email address and try again." : "Enter your email so we can send your receipt and order updates.";
    error.classList.add("show");
  }
  return "";
}

function resetCheckoutButton() {
  const btn = $("checkoutBtn");
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = "Secure checkout →";
}

/* =====================================================================
   CHECKOUT — Stripe Checkout (via Worker) OR Formspree fallback
   ===================================================================== */
async function goCheckout() {
  if (STATE.cart.length === 0) return;
  const email = validatedCheckoutEmail();
  if (!email) return;
  const btn = $("checkoutBtn");
  btn.disabled = true;
  btn.textContent = "Preparing checkout…";
  showCheckoutStatus("Preparing your secure checkout…");

  // Reference photo attachments (if any) go out as their own email — separate from
  // the Stripe/payment flow entirely, since Stripe Checkout can't carry file uploads.
  const allAttachedFiles = STATE.cart.flatMap(it => ITEM_FILES[it.lineId] || []);
  if (allAttachedFiles.length) {
    const totalBytes = allAttachedFiles.reduce((s, f) => s + f.size, 0);
    if (allAttachedFiles.length > CFORM_MAX_FILES || totalBytes > CFORM_MAX_TOTAL_BYTES) {
      showCheckoutStatus(`Please keep reference photos to ${CFORM_MAX_FILES} files and 15MB total. Your order currently has ${allAttachedFiles.length} files (${formatFileSize(totalBytes)}).`, "error");
      resetCheckoutButton();
      return;
    }
    sendReferencePhotosEmail(email); // fire-and-forget; doesn't block or affect checkout
  }

  if (CONFIG.STRIPE_CHECKOUT_ENDPOINT) {
    const orderNumber = generateOrderNumber();
    try {
      localStorage.setItem("twl_pending_order", JSON.stringify({ orderNumber, email }));
    } catch (e) {}
    try {
      // Build line items for Stripe (cents)
      const items = STATE.cart.map(it => ({
        name: it.name + (it.colour !== "As shown" ? ` (${it.colour})` : "") + (it.message ? ` — note: ${it.message}` : ""),
        amount_cents: Math.round(it.price * 100),
        quantity: it.qty,
        image: location.origin + "/" + it.img,
      }));
      const skipShipping = STATE.cart.some(it => it.__skipShipping);
      const r = await fetch(CONFIG.STRIPE_CHECKOUT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: CONFIG.CURRENCY.toLowerCase(),
          items,
          success_url: location.origin + "/checkout/success",
          cancel_url:  location.origin + "/checkout/cancel",
          customer_email: email,
          skipShipping,
        }),
      });
      if (!r.ok) throw new Error("Checkout session failed (" + r.status + ")");
      const data = await r.json();
      if (data.url) {
        window.location = data.url;
        return;
      }
      throw new Error("Missing checkout URL");
    } catch (err) {
      console.error(err);
      showCheckoutStatus("We couldn't start checkout right now. Please try again, or email hello@tangledwithlove.com and we'll help.", "error");
      resetCheckoutButton();
    }
  } else {
    // Fallback: no Stripe configured — submit order to Formspree as email
    try {
      const orderSummary = orderSummaryText();
      const total = fmt(cartSubtotal());
      const orderNumber = generateOrderNumber();
      await fetch(`https://formspree.io/f/${CONFIG.FORMSPREE_ID}`, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          _subject: `New order ${orderNumber} — tangledwithlove.com`,
          orderNumber,
          email,
          total,
          order: orderSummary,
        }),
      });
      sendOrderEmails(orderNumber, email); // fire-and-forget branded copy alongside the Formspree one
      STATE.cart = [];
      clearItemFiles();
      saveCart(); renderCart(); closeCart();
      showPage("success");
      $("successOrderId").textContent = `Order ${orderNumber} received — we'll email you at ${email}`;
      $("successOrderId").style.display = "inline-block";
    } catch (err) {
      console.error(err);
      showCheckoutStatus("Something went wrong. Please try again, or email hello@tangledwithlove.com.", "error");
      resetCheckoutButton();
    }
  }
}

function resetAndHome() {
  STATE.cart = [];
  clearItemFiles();
  saveCart(); renderCart();
  navTo("shop");
}

/* =====================================================================
   ORDER NUMBERS + EMAILJS NOTIFICATIONS
   (Stripe's own checkout session is untouched by any of this — this is
   purely our own bookkeeping/branded email layer alongside it.)
   ===================================================================== */
function generateOrderNumber() {
  const d = new Date();
  const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids visual ambiguity
  let rand = "";
  for (let i = 0; i < 5; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `TWL-${datePart}-${rand}`;
}

function orderSummaryText() {
  return STATE.cart.map(it =>
    `${it.qty} × ${it.name} @ ${fmt(it.price)} — Colour: ${it.colour}${it.message ? ' — "' + it.message + '"' : ''}${it.filesCount ? ' — ' + it.filesCount + ' file(s) attached (sent separately)' : ''}`
  ).join("\n");
}

async function sendOrderEmails(orderNumber, email) {
  let emailClient;
  try { emailClient = await loadEmailJs(); }
  catch (err) { console.error("Email service failed to load", err); return; }
  if (!emailClient) return;
  const params = {
    form_type: "order",
    from_name: email ? email.split("@")[0].replace(/^\w/, c => c.toUpperCase()) : "Customer",
    reply_to: email || "—",
    phone: "—",
    interest: "—",
    message: `Order Number: ${orderNumber}\n\n${orderSummaryText()}\n\nTotal: ${fmt(cartSubtotal())}`,
  };
  try { await emailClient.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_OWNER, params); }
  catch (err) { console.error("Owner order email failed", err); }
  if (email) {
    try { await emailClient.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_CUSTOMER, params); }
    catch (err) { console.error("Customer order email failed", err); }
  }
}

/* =====================================================================
   LIGHTBOX
   ===================================================================== */
function updateLightboxImage() {
  const productName = STATE.detail ? STATE.detail.variant.name : "Product";
  $("lightboxImage").src = STATE.lightboxImages[STATE.lightboxIdx];
  $("lightboxImage").alt = `${productName} photo ${STATE.lightboxIdx + 1}`;
  $("lightboxCounter").textContent = (STATE.lightboxIdx+1) + " / " + STATE.lightboxImages.length;
}
function openImageLightbox(idx, ev) {
  ev && ev.stopPropagation();
  if (!STATE.lightboxImages.length) return;
  if (Number.isInteger(idx)) pickThumb(idx);
  updateLightboxImage();
  $("imageLightbox").setAttribute("aria-hidden", "false");
  $("imageLightbox").querySelector(".lightbox-prev").hidden = STATE.lightboxImages.length < 2;
  $("imageLightbox").querySelector(".lightbox-next").hidden = STATE.lightboxImages.length < 2;
  $("imageLightbox").classList.add("open");
}
function closeImageLightbox(ev) {
  if (ev && ev.target.id && ev.target.id !== "imageLightbox" && ev.target.className !== "lightbox-close") return;
  $("imageLightbox").classList.remove("open");
  $("imageLightbox").setAttribute("aria-hidden", "true");
}
function prevImageLightbox(ev) { ev && ev.stopPropagation(); STATE.lightboxIdx = (STATE.lightboxIdx - 1 + STATE.lightboxImages.length) % STATE.lightboxImages.length; pickThumb(STATE.lightboxIdx); updateLightboxImage(); }
function nextImageLightbox(ev) { ev && ev.stopPropagation(); STATE.lightboxIdx = (STATE.lightboxIdx + 1) % STATE.lightboxImages.length; pickThumb(STATE.lightboxIdx); updateLightboxImage(); }
document.addEventListener("keydown", (e) => {
  if (!$("imageLightbox").classList.contains("open")) return;
  if (e.key === "Escape") closeImageLightbox({target:{id:"imageLightbox"}});
  if (e.key === "ArrowLeft") prevImageLightbox();
  if (e.key === "ArrowRight") nextImageLightbox();
});

function setupLightboxGestures() {
  const lightbox = $("imageLightbox");
  let touchStart = null;
  lightbox.addEventListener("touchstart", event => {
    const touch = event.touches[0];
    if (touch) touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  lightbox.addEventListener("touchend", event => {
    if (!touchStart || STATE.lightboxImages.length < 2) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    dx > 0 ? prevImageLightbox() : nextImageLightbox();
  }, { passive: true });
}

function setupFaqAccordion() {
  const items = [...document.querySelectorAll(".faq-item")];
  items.forEach(item => item.addEventListener("toggle", () => {
    if (!item.open) return;
    items.forEach(other => { if (other !== item) other.open = false; });
  }));
}

/* =====================================================================
   CONTACT FORM (Formspree)
   ===================================================================== */
const CFORM_MAX_FILES = 5;
const CFORM_MAX_TOTAL_BYTES = 15 * 1024 * 1024;
// Actual File objects for cart-line attachments, keyed by lineId. Kept in memory only —
// File objects can't survive the cart's JSON.stringify localStorage persistence.
const ITEM_FILES = {};
function clearItemFiles() { Object.keys(ITEM_FILES).forEach(k => delete ITEM_FILES[k]); }

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function validateFileSelection(input, listEl) {
  const files = Array.from(input.files || []);
  if (!files.length) { listEl.textContent = ""; listEl.classList.remove("error"); return true; }
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const totalSize = formatFileSize(totalBytes);
  if (files.length > CFORM_MAX_FILES) {
    listEl.textContent = `✖ Please attach at most ${CFORM_MAX_FILES} files (you selected ${files.length}, ${totalSize} total).`;
    listEl.classList.add("error");
    return false;
  }
  if (totalBytes > CFORM_MAX_TOTAL_BYTES) {
    listEl.textContent = `✖ Total attachment size is ${totalSize} — please keep it under 15MB.`;
    listEl.classList.add("error");
    return false;
  }
  listEl.textContent = `${files.length} file${files.length > 1 ? "s" : ""} selected (${totalSize} total)`;
  listEl.classList.remove("error");
  return true;
}
function validateContactFiles(input) { return validateFileSelection(input, $("cformFileList")); }

// Sends any reference photos attached to cart items as their own email, entirely
// separate from the Stripe/payment flow (Stripe Checkout can't carry files).
async function sendReferencePhotosEmail(email="") {
  const entries = STATE.cart
    .map(it => ({ it, files: ITEM_FILES[it.lineId] || [] }))
    .filter(x => x.files.length);
  if (!entries.length) return;
  const summary = entries.map(x => `${x.it.name} (${x.it.colour}): ${x.files.length} file(s)`).join("\n");
  const allFiles = entries.flatMap(x => x.files);
  try {
    if (CONFIG.MAIL_WORKER_ENDPOINT) {
      const fd = new FormData();
      fd.append("form_type", "order");
      if (email) fd.append("reply_to", email);
      fd.append("message", summary);
      allFiles.forEach(f => fd.append("attachments", f, f.name));
      const r = await fetch(CONFIG.MAIL_WORKER_ENDPOINT, { method: "POST", body: fd });
      if (!r.ok) throw new Error("Mail worker error (" + r.status + ")");
    } else if (CONFIG.FORMSPREE_ID && CONFIG.FORMSPREE_ID !== "FORMSPREE_ID") {
      const fd = new FormData();
      fd.append("_subject", "Reference photos — order via tangledwithlove.com");
      if (email) fd.append("email", email);
      fd.append("summary", summary);
      allFiles.forEach(f => fd.append("attachments", f, f.name));
      await fetch(`https://formspree.io/f/${CONFIG.FORMSPREE_ID}`, { method: "POST", body: fd, headers: { Accept: "application/json" } });
    }
  } catch (err) {
    console.error("Reference photo email failed", err);
  }
}

function updateContactFormProgress() {
  const name = $("contactName");
  const email = $("contactEmail");
  const interest = $("contactInterest");
  const message = $("contactMessage");
  if (!name || !email || !interest || !message) return;
  const completed = [
    name.value.trim().length >= 2,
    email.value.trim().length > 0 && email.validity.valid,
    Boolean(interest.value),
    message.value.trim().length >= 10,
  ].filter(Boolean).length;
  $("cformProgressText").textContent = completed === 4 ? "Ready to send ♥" : `${completed} of 4 essentials`;
  $("cformProgressFill").style.width = `${completed * 25}%`;
  $("cformProgressTrack").setAttribute("aria-valuenow", String(completed));
  $("contactMessageCount").textContent = `${message.value.length} / 600`;
}

function wireContactForm() {
  const form = $("contactForm");
  if (!form) return;
  // Wire the form action using CONFIG.FORMSPREE_ID (so it works even if user forgets to edit the HTML)
  if (CONFIG.FORMSPREE_ID && CONFIG.FORMSPREE_ID !== "FORMSPREE_ID") {
    form.action = `https://formspree.io/f/${CONFIG.FORMSPREE_ID}`;
  }
  const fileInput = $("cformFiles");
  if (fileInput) fileInput.addEventListener("change", () => validateContactFiles(fileInput));
  const detailFilesInput = $("detailFiles");
  if (detailFilesInput) detailFilesInput.addEventListener("change", () => validateFileSelection(detailFilesInput, $("detailFileList")));
  ["contactName", "contactEmail", "contactInterest", "contactMessage"].forEach(id => {
    $(id).addEventListener("input", updateContactFormProgress);
    $(id).addEventListener("change", updateContactFormProgress);
  });
  updateContactFormProgress();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("cformMsg");
    msg.classList.remove("show"); msg.textContent = "";
    if (fileInput && fileInput.files.length && !validateContactFiles(fileInput)) {
      return;
    }
    const hasFiles = fileInput && fileInput.files.length > 0;
    const interestVal = form.querySelector('[name="interest"]').value;
    const isReview = interestVal === "Leave a review";
    const formType = isReview ? "review" : "message";
    try {
      if (hasFiles || isReview) {
        if (CONFIG.MAIL_WORKER_ENDPOINT) {
          // Attachments (and reviews, so they get the review email template) go
          // through the mail Worker (Resend) — Formspree's free plan doesn't
          // support file uploads.
          const data = new FormData();
          data.append("form_type", formType);
          data.append("from_name", form.querySelector('[name="name"]').value);
          data.append("reply_to", form.querySelector('[name="email"]').value);
          data.append("phone", form.querySelector('[name="phone"]').value || "—");
          data.append("interest", interestVal);
          data.append("message", form.querySelector('[name="message"]').value);
          Array.from(fileInput.files).forEach(f => data.append("attachments", f, f.name));
          const r = await fetch(CONFIG.MAIL_WORKER_ENDPOINT, { method: "POST", body: data });
          if (!r.ok) throw new Error("Form error");
        } else {
          if (!CONFIG.FORMSPREE_ID || CONFIG.FORMSPREE_ID === "FORMSPREE_ID") {
            msg.textContent = "✖ Contact form isn't connected yet. Please set CONFIG.FORMSPREE_ID.";
            msg.classList.add("show");
            return;
          }
          const data = new FormData(form);
          const r = await fetch(form.action, { method: "POST", body: data, headers: { Accept: "application/json" } });
          if (!r.ok) throw new Error("Form error");
        }
      } else {
        // No attachments — send our own branded owner + customer emails via EmailJS.
        const emailClient = await loadEmailJs();
        if (!emailClient) {
          msg.textContent = "✖ Contact form isn't connected yet. Please set CONFIG.EMAILJS_PUBLIC_KEY.";
          msg.classList.add("show");
          return;
        }
        const params = {
          form_type: formType,
          from_name: form.querySelector('[name="name"]').value,
          reply_to: form.querySelector('[name="email"]').value,
          phone: form.querySelector('[name="phone"]').value || "—",
          interest: interestVal,
          message: form.querySelector('[name="message"]').value,
        };
        await emailClient.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_OWNER, params);
        await emailClient.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_CUSTOMER, params);
      }
      msg.textContent = "✓ Thank you! We'll reply within 1–2 days.";
      msg.classList.add("show");
      form.reset();
      $("cformFileList").textContent = "";
      updateContactFormProgress();
    } catch (err) {
      msg.textContent = "Sorry, something went wrong. Please email hello@tangledwithlove.com directly.";
      msg.classList.add("show");
    }
  });
}

/* =====================================================================
   SHOP ENTRY
   ===================================================================== */
// Hook the featured category card buttons to go to categories page
function attachShopListener() {
  // "Shop" nav link scrolls to #shop on home
  // Separate "Shop by style" cards call openCategory directly
}

// Handle Stripe return routes. Legacy ?checkout= URLs remain supported.
function handleCheckoutReturn() {
  const u = new URL(window.location.href);
  const path = normalizeRoutePath(u.pathname);
  const r = u.searchParams.get("checkout") || (path === "/checkout/success" ? "success" : path === "/checkout/cancel" ? "cancel" : "");
  if (r === "success") {
    STATE.cart = [];
    clearItemFiles();
    saveCart(); renderCart();
    const sid = u.searchParams.get("session_id");
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem("twl_pending_order") || "null"); } catch (e) {}
    const lines = [];
    if (pending && pending.orderNumber) lines.push(`Order ${pending.orderNumber}`);
    if (sid) lines.push(`Stripe confirmation ${sid.slice(-8).toUpperCase()}`);
    if (lines.length) {
      $("successOrderId").textContent = lines.join(" · ");
      $("successOrderId").style.display = "inline-block";
    }
    if (pending && pending.orderNumber) {
      sendOrderEmails(pending.orderNumber, pending.email); // fire-and-forget; our own branded copy, separate from Stripe's own receipt
      try { localStorage.removeItem("twl_pending_order"); } catch (e) {}
    }
    history.replaceState({}, "", routeHref("/checkout/success"));
  } else if (r === "cancel") {
    history.replaceState({}, "", routeHref("/checkout/cancel"));
  }
  return r;
}

// Dev: visit /?test=1 to seed a $1 test item for live-mode Stripe sanity checks.
// Invisible to customers (no UI surface). Strips the param after seeding so refresh
// doesn't re-seed. Returns true if it seeded so init can open the cart drawer.
function handleTestSeed() {
  if (new URLSearchParams(location.search).get("test") !== "1") return false;
  STATE.cart = [{
    lineId: "test-" + Date.now(),
    variantId: "test",
    categoryId: "test",
    name: "Test Purchase — please ignore",
    price: 1,
    qty: 1,
    colour: "As shown",
    message: "",
    img: "assets/products/xs-bags/sunshine/1.png",
    __skipShipping: true,
  }];
  saveCart();
  history.replaceState({}, "", routeHref("/"));
  return true;
}

// Custom order: visit /?custom=1&name=...&price=...&qty=...&for=...&note=... to
// seed a one-off custom item into the cart and show a personalized welcome page.
// Used when mum has agreed a custom piece with a customer over email/DM —
// she hands them a URL with the agreed item + price, they land on a styled
// welcome page, then pay through normal Stripe Checkout. Shipping is skipped
// (assume in-person handover or shipping baked into the agreed price).
//
// Params:
//   name=Custom%20Sweater%20for%20Sarah   line-item name (shows in cart + Stripe)
//   price=85                              dollars per unit
//   qty=2                                 quantity, default 1
//   for=Sarah                             optional: name in the greeting
//   note=Thanks%20for%20being...          optional: handwritten-style personal note
//
// Returns true if seeded (init will then showPage("custom-welcome")).
function handleCustomSeed() {
  const p = new URLSearchParams(location.search);
  if (p.get("custom") !== "1") return false;
  const name = (p.get("name") || "").trim() || "Custom Order";
  const price = parseFloat(p.get("price") || "0");
  const qty = parseInt(p.get("qty") || "1", 10);
  const forName = (p.get("for") || "").trim();
  const note = (p.get("note") || "").trim();
  const isFirstCustomer = p.get("first") === "1";
  if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(qty) || qty <= 0) {
    showToast("This custom-order link needs a valid price and quantity.", "!");
    return false;
  }
  const img = "assets/mum.jpg";
  STATE.cart = [{
    lineId: "custom-" + Date.now(),
    variantId: "custom",
    categoryId: "custom",
    name,
    price,
    qty,
    colour: "As shown",
    message: "",
    img,
    __skipShipping: true,
  }];
  saveCart();

  // Populate the welcome page DOM (cosy design).
  // Hero greeting — try to split "Sam and Tushar" into two display names.
  const heroNamesEl = $("cwHeroNames");
  if (heroNamesEl) {
    const formattedNames = forName
      ? forName.replace(/\s+and\s+/i, " & ").replace(/\s*&\s*/g, " & ")
      : "you";
    heroNamesEl.textContent = formattedNames;
  }
  // Product card
  if ($("cwProductName")) $("cwProductName").textContent = name;
  if ($("cwProductPrice")) {
    $("cwProductPrice").innerHTML = `$${price.toFixed(0)}<span class="cw-each"> ea</span>`;
  }
  if ($("cwQtyDisplay")) $("cwQtyDisplay").textContent = qty;
  if ($("cwCartDot")) $("cwCartDot").textContent = qty;
  // Summary
  if ($("cwSumItemLabel")) $("cwSumItemLabel").textContent = `${name} × ${qty}`;
  if ($("cwSumItemAmount")) $("cwSumItemAmount").textContent = fmt(price * qty);
  // Note from mum — render as paragraphs in the handwritten card. Falls back
  // to a generic warm message if no &note= was provided in the URL.
  const noteBodyEl = $("cwNoteBody");
  if (noteBodyEl) {
    const noteText = note || `To ${forName || "you"} — thank you for trusting mum with these. Made with love.`;
    // Replace standalone "&" or "and" between names if present, and add a tiny
    // heart after the salutation line for a soft, hand-written touch.
    noteBodyEl.textContent = noteText;
  }
  const noteMetaEl = $("cwNoteMeta");
  if (noteMetaEl) {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    noteMetaEl.textContent = `stitched · ${today}`;
  }

  // Count-up animation on the summary total.
  const totalEl = $("cwSumTotal");
  const totalAmount = price * qty;
  const reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (totalEl) {
    if (reduceMotion) {
      totalEl.textContent = fmt(totalAmount);
    } else {
      totalEl.textContent = fmt(0);
      setTimeout(() => {
        let start = null;
        const dur = 1100;
        const step = (ts) => {
          if (!start) start = ts;
          const t = Math.min((ts - start) / dur, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          totalEl.textContent = fmt(totalAmount * eased);
          if (t < 1) requestAnimationFrame(step);
          else totalEl.textContent = fmt(totalAmount);
        };
        requestAnimationFrame(step);
      }, 700);
    }
  }

  history.replaceState({}, "", routeHref("/custom-order"));
  return true;
}

/* =====================================================================
   INIT
   ===================================================================== */
// Canvas confetti burst — no external dep. Fires brand-colored paper rectangles
// from the top of the welcome page, spreading outward + falling under gravity.
function fireConfetti(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  const colors = ["#C45C2A","#6B8F6E","#E8B49A","#C9952A","#7C5035","#D4845A","#7B4F6E","#3D7A72"];
  const count = 120;
  const pieces = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      x: w / 2 + (Math.random() - 0.5) * 80,
      y: h * 0.25,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 16 - 6,
      sw: Math.random() * 7 + 5,
      sh: Math.random() * 4 + 3,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0,
    });
  }
  const gravity = 0.32, maxLife = 200;
  let raf;
  function frame() {
    ctx.clearRect(0, 0, w, h);
    let alive = false;
    for (const p of pieces) {
      p.life++;
      if (p.life > maxLife) continue;
      alive = true;
      p.vy += gravity;
      p.vx *= 0.995;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      const fade = p.life > maxLife - 40 ? (maxLife - p.life) / 40 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.sw / 2, -p.sh / 2, p.sw, p.sh);
      ctx.restore();
    }
    if (alive) raf = requestAnimationFrame(frame); else cancelAnimationFrame(raf);
  }
  frame();
}

function activateCustomWelcome() {
  const page = $("page-custom-welcome");
  if (!page) return;
  // Force a reflow before adding the class — guarantees the browser sees
  // the "before" state, so animations actually trigger when class lands.
  page.classList.remove("cw-on");
  void page.offsetWidth;
  page.classList.add("cw-on");
  const reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) {
    setTimeout(() => fireConfetti($("cwConfetti")), 250);
  }
}

function migrateLegacyProductUrl() {
  const key = new URLSearchParams(location.search).get("product");
  if (!key) return false;
  const [catId, vId] = key.split("::");
  if (!findVariant(catId, vId)) return false;
  history.replaceState({}, "", routeHref(productRoutePath(vId)));
  return true;
}

function init() {
  loadCart();
  restoreCheckoutEmail();
  loadPersonalization();
  const testSeeded = handleTestSeed();
  const customSeeded = handleCustomSeed();
  renderHeroCards();
  renderCategoryRow();
  renderCategoriesPage();
  renderRecentlyViewed();
  updateWishlistUI();
  renderReviews();
  renderCart();
  wireContactForm();
  setupFaqAccordion();
  setupLightboxGestures();
  const checkoutState = handleCheckoutReturn();
  if (!testSeeded && !customSeeded && !checkoutState) migrateLegacyProductUrl();
  setupNavigation();
  if (testSeeded) openCart();
  setupRevealAnimations();
}
document.addEventListener("DOMContentLoaded", init);
