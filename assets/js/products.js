import { supabase } from "./supabase.js";
import { addToCart, weightBox, wireWeight, chosenQty, isKg } from "./cart.js";
import { esc, money, renderStoreChrome } from "./site.js";

const state = { products: [], categories: [], category: "all", search: "", sort: "new" };
const $ = id => document.getElementById(id);

function card(p) {
  const price = Number(p.sale_price ?? p.price ?? 0);
  const old = p.sale_price != null ? `<span class="old-price">${money(p.price)}</span>` : "";
  return `<article class="product-card">
    <div class="product-media">${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">` : `<div class="media-fallback">Y</div>`}
      ${p.sale_price != null ? `<span class="sale-badge">OFFER</span>` : ""}
      ${!p.is_available ? `<span class="soldout-badge">OUT OF STOCK</span>` : ""}
    </div>
    <div class="product-content">
      <span class="eyebrow-sm">${esc(p.category_name || "Product")}</span>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.description || "Fresh quality product from YACUBA ONLINE STORE.")}</p>
      ${weightBox(p)}<div class="price-line"><div>${old}<strong>${money(price)}</strong>${isKg(p) ? "<small> / kg</small>" : ""}</div>
        <button class="bag-btn" type="button" data-add="${p.id}" ${!p.is_available ? "disabled" : ""}>${p.is_available ? "Add to Bag" : "Unavailable"}</button>
      </div>
    </div>
  </article>`;
}

function renderFilters() {
  const wrap = $("categoryFilters");
  wrap.innerHTML = `<button class="chip ${state.category === "all" ? "active" : ""}" data-cat="all">All</button>` +
    state.categories.map(c => `<button class="chip ${state.category === c.id ? "active" : ""}" data-cat="${c.id}">${esc(c.name)}</button>`).join("");
  wrap.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { state.category = b.dataset.cat; renderFilters(); render(); });
}
function render() {
  const q = state.search.trim().toLowerCase();
  const list = state.products.filter(p =>
    (state.category === "all" || p.category_id === state.category) &&
    (!q || p.name.toLowerCase().includes(q) || String(p.description || "").toLowerCase().includes(q))
  );
  const eff = p => Number(p.sale_price ?? p.price ?? 0);
  if (state.sort === "low") list.sort((a, b) => eff(a) - eff(b));
  else if (state.sort === "high") list.sort((a, b) => eff(b) - eff(a));
  else if (state.sort === "offer") list.sort((a, b) => (b.sale_price != null) - (a.sale_price != null));
  $("productsGrid").innerHTML = list.length ? list.map(card).join("") : `<div class="empty-state"><h3>No products found</h3><p>Try another search or category.</p></div>`;
  $("resultCount").textContent = `${list.length} product${list.length === 1 ? "" : "s"}`;
  wireWeight();
  document.querySelectorAll("[data-add]").forEach(b => b.onclick = () => {
    const p = state.products.find(x => x.id === b.dataset.add); if (!p) return;
    addToCart({...p, category_name: p.category_name}, chosenQty(p));
    b.textContent = "Added ✓"; setTimeout(() => b.textContent = "Add to Bag", 900);
    openBagToast(p.name);
  });
}
function openBagToast(name) {
  const toast = $("bagToast"); toast.textContent = `${name} added to your bag.`; toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}
async function load() {
  const [c, p] = await Promise.all([
    supabase.from("categories").select("id,name").order("name"),
    supabase.from("products").select("id,name,description,price,sale_price,is_available,image_url,category_id,unit,qty_step").order("created_at", {ascending:false})
  ]);
  if (c.error) throw c.error; if (p.error) throw p.error;
  const map = new Map((c.data || []).map(x => [x.id, x.name]));
  state.categories = c.data || [];
  state.products = (p.data || []).map(x => ({...x, category_name: map.get(x.category_id) || "Product"}));
  const wanted = new URLSearchParams(location.search).get("category");
  if (wanted && state.categories.some(x => x.id === wanted)) state.category = wanted;
  renderFilters(); render(); renderStoreChrome();
}

document.addEventListener("DOMContentLoaded", async () => {
  $("productSearch").addEventListener("input", e => { state.search = e.target.value; render(); });
  $("productSort")?.addEventListener("change", e => { state.sort = e.target.value; render(); });
  try { await load(); } catch (e) { console.error(e); $("productsGrid").innerHTML = `<div class="empty-state"><h3>Products are temporarily unavailable</h3><p>${esc(e.message)}</p></div>`; }
});
