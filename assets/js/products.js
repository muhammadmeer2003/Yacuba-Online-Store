import { supabase } from "./supabase.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const state = { categories: [], products: [], category: "all", search: "" };
const $ = id => document.getElementById(id);
const money = value => `₱ ${Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function assertConfig() {
  if (!SUPABASE_URL.startsWith("https://") || !SUPABASE_URL.includes("supabase.co")) throw new Error("Supabase Project URL is missing.");
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("PASTE_YOUR") || SUPABASE_ANON_KEY.startsWith("YOUR_")) throw new Error("Supabase Publishable key is missing.");
}

function renderCategories() {
  const wrap = $("categoryFilters"); if (!wrap) return;
  wrap.innerHTML = [
    `<button class="filter-btn ${state.category === "all" ? "active" : ""}" data-category="all">All Products</button>`,
    ...state.categories.map(c => `<button class="filter-btn ${state.category === c.id ? "active" : ""}" data-category="${c.id}">${esc(c.name)}</button>`)
  ].join("");
  wrap.querySelectorAll("[data-category]").forEach(btn => btn.onclick = () => { state.category = btn.dataset.category; renderCategories(); renderProducts(); });
}

function matches(product) {
  const categoryMatch = state.category === "all" || product.category_id === state.category;
  const q = state.search.trim().toLowerCase();
  return categoryMatch && (!q || product.name.toLowerCase().includes(q) || (product.description || "").toLowerCase().includes(q) || (product.category_name || "").toLowerCase().includes(q));
}

function card(p) {
  const image = p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">` : `<div class="product-placeholder">No Image</div>`;
  const price = p.sale_price != null ? `<div class="price-row"><span class="old-price">${money(p.price)}</span><span class="sale-price">${money(p.sale_price)}</span></div>` : `<div class="price-row"><span class="sale-price">${money(p.price)}</span></div>`;
  return `<article class="product-card"><div class="product-image-wrap">${image}<span class="stock-badge ${p.is_available ? "in-stock" : ""}">${p.is_available ? "Available" : "Out of Stock"}</span></div><div class="product-body"><div class="product-category">${esc(p.category_name || "Product")}</div><h3>${esc(p.name)}</h3><p>${esc(p.description || "Fresh quality product from YACUBA ONLINE STORE.")}</p>${price}</div></article>`;
}

function renderProducts() {
  const grid = $("productsGrid"); if (!grid) return;
  const filtered = state.products.filter(matches);
  grid.innerHTML = filtered.length ? filtered.map(card).join("") : `<div class="empty-state"><h3>No products found</h3><p>Try another category or search term.</p></div>`;
  $("productCount").textContent = `${filtered.length} product${filtered.length === 1 ? "" : "s"}`;
}

async function loadData() {
  assertConfig();
  const [catRes, productRes] = await Promise.all([
    supabase.from("categories").select("id,name").order("name"),
    supabase.from("products").select("id,name,description,price,sale_price,is_available,image_url,category_id,created_at").order("created_at", { ascending: false })
  ]);
  if (catRes.error) throw new Error(catRes.error.message);
  if (productRes.error) throw new Error(productRes.error.message);
  state.categories = catRes.data || [];
  const map = new Map(state.categories.map(c => [c.id, c.name]));
  state.products = (productRes.data || []).map(p => ({ ...p, category_name: map.get(p.category_id) || "No category" }));
  renderCategories();
  renderProducts();
}

document.addEventListener("DOMContentLoaded", async () => {
  const search = $("productSearch");
  if (search) search.addEventListener("input", () => { state.search = search.value; renderProducts(); });
  try {
    await loadData();
  } catch (error) {
    console.error(error);
    const grid = $("productsGrid");
    if (grid) grid.innerHTML = `<div class="empty-state"><h3>Products are not connected yet</h3><p>${esc(error.message)}</p><p style="margin-top:12px">Check <strong>assets/js/config.js</strong> and make sure the Supabase Publishable key is present.</p></div>`;
    const count = $("productCount"); if (count) count.textContent = "Setup needed";
  }
});
