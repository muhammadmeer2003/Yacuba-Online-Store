import { supabase } from "./supabase.js";

const state = { categories: [], products: [], category: "all", search: "" };
const $ = id => document.getElementById(id);
const money = value => `Rs. ${Number(value || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function renderCategories() {
  const wrap = $("categoryFilters");
  wrap.innerHTML = [
    `<button class="filter-btn ${state.category === "all" ? "active" : ""}" data-category="all">All Products</button>`,
    ...state.categories.map(c => `<button class="filter-btn ${state.category === c.id ? "active" : ""}" data-category="${c.id}">${esc(c.name)}</button>`)
  ].join("");
  wrap.querySelectorAll("[data-category]").forEach(btn => btn.addEventListener("click", () => {
    state.category = btn.dataset.category;
    renderCategories();
    renderProducts();
  }));
}

function matches(p) {
  const categoryMatch = state.category === "all" || p.category_id === state.category;
  const q = state.search.trim().toLowerCase();
  const searchMatch = !q || p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q) || (p.categories?.name || "").toLowerCase().includes(q);
  return categoryMatch && searchMatch;
}

function card(p) {
  const image = p.image_url ? `<img src="${p.image_url}" alt="${esc(p.name)}" loading="lazy">` : `<div class="product-placeholder">No Image</div>`;
  const prices = p.sale_price != null && Number(p.sale_price) > 0
    ? `<span class="old-price">${money(p.price)}</span><span class="sale-price">${money(p.sale_price)}</span>`
    : `<span class="sale-price">${money(p.price)}</span>`;
  return `<article class="product-card">
    <div class="product-image-wrap">${image}<span class="stock-badge ${p.is_available ? "in-stock" : ""}">${p.is_available ? "Available" : "Out of Stock"}</span></div>
    <div class="product-body"><div class="product-category">${esc(p.categories?.name || "Product")}</div><h3>${esc(p.name)}</h3><p>${esc(p.description || "Fresh quality product from our mart.")}</p><div class="price-row">${prices}</div></div>
  </article>`;
}

function renderProducts() {
  const grid = $("productsGrid");
  const filtered = state.products.filter(matches);
  $("productCount").textContent = `${filtered.length} product${filtered.length === 1 ? "" : "s"}`;
  grid.innerHTML = filtered.length ? filtered.map(card).join("") : `<div class="empty-state"><h3>No products found</h3><p>Try another category or search term.</p></div>`;
}

async function load() {
  const [c, p] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("products").select("id,name,description,price,sale_price,is_available,image_url,category_id,categories(name)").order("created_at", { ascending: false })
  ]);
  if (c.error) throw c.error;
  if (p.error) throw p.error;
  state.categories = c.data || [];
  state.products = p.data || [];
  renderCategories();
  renderProducts();
}

document.addEventListener("DOMContentLoaded", async () => {
  $("productSearch")?.addEventListener("input", e => { state.search = e.target.value; renderProducts(); });
  try { await load(); }
  catch (err) { console.error(err); $("productsGrid").innerHTML = `<div class="empty-state"><h3>Products could not be loaded</h3><p>Check the Supabase configuration and database setup.</p></div>`; }
});
