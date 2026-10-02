import { supabase } from "./supabase.js";

const $ = id => document.getElementById(id);
const BUCKET = "product-images";
const state = { categories: [], products: [], editingProductId: null, editingCategoryId: null };
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const money = value => Number(value || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { location.href = "./login.html"; return null; }
  const { data: profile, error } = await supabase.from("profiles").select("id,email,role").eq("id", user.id).single();
  if (error || !profile || profile.role !== "admin") {
    await supabase.auth.signOut();
    alert("This account is not authorized as an admin.");
    location.href = "./login.html";
    return null;
  }
  $("adminEmail").textContent = profile.email || user.email || "";
  return user;
}

async function loadCategories() {
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) throw error;
  state.categories = data || [];
  renderCategories();
  renderCategorySelect();
}

async function loadProducts() {
  const { data, error } = await supabase.from("products").select("id,name,description,price,sale_price,is_available,image_url,image_path,category_id,created_at,categories(name)").order("created_at", { ascending: false });
  if (error) throw error;
  state.products = data || [];
  renderProducts();
}

function renderCategorySelect() {
  $("productCategory").innerHTML = `<option value="">No category</option>` + state.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
}

function renderCategories() {
  $("categoriesList").innerHTML = state.categories.length ? state.categories.map(c => `<div class="admin-list-row"><strong>${esc(c.name)}</strong><div class="row-actions"><button class="small-btn" data-edit-category="${c.id}">Edit</button><button class="small-btn danger" data-delete-category="${c.id}">Delete</button></div></div>`).join("") : `<div class="admin-empty">No categories yet.</div>`;
  document.querySelectorAll("[data-edit-category]").forEach(b => b.onclick = () => startEditCategory(b.dataset.editCategory));
  document.querySelectorAll("[data-delete-category]").forEach(b => b.onclick = () => deleteCategory(b.dataset.deleteCategory));
}

function renderProducts() {
  $("productsList").innerHTML = state.products.length ? state.products.map(p => `<div class="admin-product-row"><div class="admin-product-thumb">${p.image_url ? `<img src="${p.image_url}" alt="">` : `<span>No image</span>`}</div><div class="admin-product-info"><div class="admin-product-top"><strong>${esc(p.name)}</strong><span class="status-pill ${p.is_available ? "available" : "soldout"}">${p.is_available ? "Available" : "Out of Stock"}</span></div><div class="admin-meta">${esc(p.categories?.name || "No category")} · Rs. ${money(p.price)}${p.sale_price ? ` · Offer Rs. ${money(p.sale_price)}` : ""}</div><p>${esc(p.description || "")}</p></div><div class="row-actions"><button class="small-btn" data-edit-product="${p.id}">Edit</button><button class="small-btn danger" data-delete-product="${p.id}">Delete</button></div></div>`).join("") : `<div class="admin-empty">No products yet.</div>`;
  document.querySelectorAll("[data-edit-product]").forEach(b => b.onclick = () => startEditProduct(b.dataset.editProduct));
  document.querySelectorAll("[data-delete-product]").forEach(b => b.onclick = () => deleteProduct(b.dataset.deleteProduct));
}

function resetProductForm() { state.editingProductId = null; $("productForm").reset(); $("productId").value = ""; $("productFormTitle").textContent = "Add Product"; $("cancelProductEdit").hidden = true; }
function startEditProduct(id) {
  const p = state.products.find(x => x.id === id); if (!p) return;
  state.editingProductId = id; $("productId").value = p.id; $("productName").value = p.name || ""; $("productCategory").value = p.category_id || ""; $("productPrice").value = p.price ?? ""; $("productSalePrice").value = p.sale_price ?? ""; $("productDescription").value = p.description || ""; $("productAvailable").checked = !!p.is_available; $("productFormTitle").textContent = "Edit Product"; $("cancelProductEdit").hidden = false; scrollTo({ top: 0, behavior: "smooth" });
}

async function saveProduct(e) {
  e.preventDefault();
  const name = $("productName").value.trim();
  const category_id = $("productCategory").value || null;
  const price = Number($("productPrice").value);
  const saleRaw = $("productSalePrice").value.trim();
  const sale_price = saleRaw === "" ? null : Number(saleRaw);
  const description = $("productDescription").value.trim();
  const is_available = $("productAvailable").checked;
  const file = $("productImage").files[0];
  if (!name || !Number.isFinite(price) || price < 0) return alert("Enter a valid product name and price.");
  const current = state.products.find(x => x.id === state.editingProductId);
  let image_url = current?.image_url || null;
  let image_path = current?.image_path || null;
  if (file) {
    const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
    const path = `${crypto.randomUUID()}-${safe}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (up.error) return alert(`Image upload failed: ${up.error.message}`);
    image_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    image_path = path;
    if (current?.image_path) await supabase.storage.from(BUCKET).remove([current.image_path]);
  }
  const payload = { name, category_id, price, sale_price, description, is_available, image_url, image_path };
  const result = state.editingProductId ? await supabase.from("products").update(payload).eq("id", state.editingProductId) : await supabase.from("products").insert(payload);
  if (result.error) return alert(result.error.message);
  alert(state.editingProductId ? "Product updated." : "Product added.");
  resetProductForm(); await loadProducts();
}

async function deleteProduct(id) {
  const p = state.products.find(x => x.id === id); if (!p || !confirm(`Delete "${p.name}"?`)) return;
  if (p.image_path) await supabase.storage.from(BUCKET).remove([p.image_path]);
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return alert(error.message);
  await loadProducts();
}

function resetCategoryForm() { state.editingCategoryId = null; $("categoryForm").reset(); $("categoryFormTitle").textContent = "Add Category"; $("cancelCategoryEdit").hidden = true; }
function startEditCategory(id) { const c = state.categories.find(x => x.id === id); if (!c) return; state.editingCategoryId = id; $("categoryName").value = c.name || ""; $("categoryFormTitle").textContent = "Edit Category"; $("cancelCategoryEdit").hidden = false; scrollTo({ top: 0, behavior: "smooth" }); }

async function saveCategory(e) {
  e.preventDefault(); const name = $("categoryName").value.trim(); if (!name) return alert("Enter a category name.");
  const result = state.editingCategoryId ? await supabase.from("categories").update({ name }).eq("id", state.editingCategoryId) : await supabase.from("categories").insert({ name });
  if (result.error) return alert(result.error.message);
  alert(state.editingCategoryId ? "Category updated." : "Category added."); resetCategoryForm(); await loadCategories(); await loadProducts();
}

async function deleteCategory(id) {
  const c = state.categories.find(x => x.id === id); if (!c || !confirm(`Delete category "${c.name}"? Products will remain but their category will become empty.`)) return;
  const { error } = await supabase.from("categories").delete().eq("id", id); if (error) return alert(error.message); await loadCategories(); await loadProducts();
}

(async () => {
  if (!await requireAdmin()) return;
  try { await loadCategories(); await loadProducts(); }
  catch (err) { console.error(err); alert(`Could not load admin data: ${err.message}`); }
  $("logoutBtn").onclick = async () => { await supabase.auth.signOut(); location.href = "./login.html"; };
  $("productForm").onsubmit = saveProduct; $("cancelProductEdit").onclick = resetProductForm;
  $("categoryForm").onsubmit = saveCategory; $("cancelCategoryEdit").onclick = resetCategoryForm;
})();
