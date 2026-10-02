import { supabase } from "./supabase.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = id => document.getElementById(id);
const BUCKET = "product-images";
const state = { categories: [], products: [], editingProductId: null, editingCategoryId: null };
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const money = value => Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });

function assertConfig() {
  if (!SUPABASE_URL.startsWith("https://") || !SUPABASE_URL.includes("supabase.co")) {
    throw new Error("Supabase Project URL is missing or invalid in assets/js/config.js.");
  }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("PASTE_YOUR") || SUPABASE_ANON_KEY.startsWith("YOUR_")) {
    throw new Error("Supabase Publishable key is missing in assets/js/config.js.");
  }
}

async function requireAdmin() {
  assertConfig();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Session check failed: ${userError.message}`);
  if (!user) {
    location.href = "./login.html";
    return null;
  }

  const { data: profile, error } = await supabase.from("profiles").select("id,email,role").eq("id", user.id).maybeSingle();
  if (error) throw new Error(`Admin profile check failed: ${error.message}`);
  if (!profile || profile.role !== "admin") {
    await supabase.auth.signOut();
    alert("This account is not authorized as an admin.");
    location.href = "./login.html";
    return null;
  }
  $("adminEmail").textContent = profile.email || user.email || "";
  return user;
}

async function loadCategories() {
  const { data, error } = await supabase.from("categories").select("id,name,created_at").order("name");
  if (error) throw new Error(`Category loading failed: ${error.message}`);
  state.categories = data || [];
  renderCategories();
  renderCategorySelect();
}

async function loadProducts() {
  const [productsRes, categoriesRes] = await Promise.all([
    supabase.from("products").select("id,name,description,price,sale_price,is_available,image_url,image_path,category_id,created_at").order("created_at", { ascending: false }),
    supabase.from("categories").select("id,name")
  ]);
  if (productsRes.error) throw new Error(`Product loading failed: ${productsRes.error.message}`);
  if (categoriesRes.error) throw new Error(`Category loading failed: ${categoriesRes.error.message}`);

  const categoryMap = new Map((categoriesRes.data || []).map(c => [c.id, c.name]));
  state.products = (productsRes.data || []).map(p => ({ ...p, category_name: categoryMap.get(p.category_id) || "No category" }));
  renderProducts();
}

function renderCategorySelect() {
  $("productCategory").innerHTML = `<option value="">No category</option>` + state.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
}

function renderCategories() {
  $("categoriesList").innerHTML = state.categories.length
    ? state.categories.map(c => `<div class="admin-list-row"><strong>${esc(c.name)}</strong><div class="row-actions"><button class="small-btn" type="button" data-edit-category="${c.id}">Edit</button><button class="small-btn danger" type="button" data-delete-category="${c.id}">Delete</button></div></div>`).join("")
    : `<div class="admin-empty">No categories yet.</div>`;
  document.querySelectorAll("[data-edit-category]").forEach(b => b.onclick = () => startEditCategory(b.dataset.editCategory));
  document.querySelectorAll("[data-delete-category]").forEach(b => b.onclick = () => deleteCategory(b.dataset.deleteCategory));
}

function renderProducts() {
  $("productsList").innerHTML = state.products.length
    ? state.products.map(p => `<div class="admin-product-row"><div class="admin-product-thumb">${p.image_url ? `<img src="${esc(p.image_url)}" alt="">` : `<span>No image</span>`}</div><div class="admin-product-info"><div class="admin-product-top"><strong>${esc(p.name)}</strong><span class="status-pill ${p.is_available ? "available" : "soldout"}">${p.is_available ? "Available" : "Out of Stock"}</span></div><div class="admin-meta">${esc(p.category_name)} · ₱ ${money(p.price)}${p.sale_price != null ? ` · Offer ₱ ${money(p.sale_price)}` : ""}</div><p>${esc(p.description || "")}</p></div><div class="row-actions"><button class="small-btn" type="button" data-edit-product="${p.id}">Edit</button><button class="small-btn danger" type="button" data-delete-product="${p.id}">Delete</button></div></div>`).join("")
    : `<div class="admin-empty">No products yet. Add your first product above.</div>`;
  document.querySelectorAll("[data-edit-product]").forEach(b => b.onclick = () => startEditProduct(b.dataset.editProduct));
  document.querySelectorAll("[data-delete-product]").forEach(b => b.onclick = () => deleteProduct(b.dataset.deleteProduct));
}

function resetProductForm() {
  state.editingProductId = null;
  $("productForm").reset();
  $("productId").value = "";
  $("productFormTitle").textContent = "Add Product";
  $("cancelProductEdit").hidden = true;
}

function startEditProduct(id) {
  const p = state.products.find(x => x.id === id); if (!p) return;
  state.editingProductId = id;
  $("productId").value = p.id;
  $("productName").value = p.name || "";
  $("productCategory").value = p.category_id || "";
  $("productPrice").value = p.price ?? "";
  $("productSalePrice").value = p.sale_price ?? "";
  $("productDescription").value = p.description || "";
  $("productAvailable").checked = !!p.is_available;
  $("productImage").value = "";
  $("productFormTitle").textContent = "Edit Product";
  $("cancelProductEdit").hidden = false;
  scrollTo({ top: 0, behavior: "smooth" });
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
  if (sale_price !== null && (!Number.isFinite(sale_price) || sale_price < 0)) return alert("Enter a valid offer price or leave it blank.");

  const current = state.products.find(x => x.id === state.editingProductId);
  let image_url = current?.image_url || null;
  let image_path = current?.image_path || null;

  try {
    if (file) {
      const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
      const path = `${crypto.randomUUID()}-${safe}`;
      const upload = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upload.error) throw new Error(`Image upload failed: ${upload.error.message}`);
      image_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      image_path = path;
    }

    const payload = { name, category_id, price, sale_price, description, is_available, image_url, image_path };
    const result = state.editingProductId
      ? await supabase.from("products").update(payload).eq("id", state.editingProductId)
      : await supabase.from("products").insert(payload);

    if (result.error) throw new Error(result.error.message);

    if (file && current?.image_path) await supabase.storage.from(BUCKET).remove([current.image_path]);
    alert(state.editingProductId ? "Product updated successfully." : "Product added successfully.");
    resetProductForm();
    await loadProducts();
  } catch (error) {
    console.error(error);
    alert(`Product save failed: ${error.message}`);
  }
}

async function deleteProduct(id) {
  const p = state.products.find(x => x.id === id); if (!p || !confirm(`Delete "${p.name}"?`)) return;
  try {
    if (p.image_path) await supabase.storage.from(BUCKET).remove([p.image_path]);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await loadProducts();
  } catch (error) {
    alert(`Product delete failed: ${error.message}`);
  }
}

function resetCategoryForm() {
  state.editingCategoryId = null;
  $("categoryForm").reset();
  $("categoryFormTitle").textContent = "Add Category";
  $("cancelCategoryEdit").hidden = true;
}

function startEditCategory(id) {
  const c = state.categories.find(x => x.id === id); if (!c) return;
  state.editingCategoryId = id;
  $("categoryName").value = c.name || "";
  $("categoryFormTitle").textContent = "Edit Category";
  $("cancelCategoryEdit").hidden = false;
  scrollTo({ top: 0, behavior: "smooth" });
}

async function saveCategory(e) {
  e.preventDefault();
  const name = $("categoryName").value.trim();
  if (!name) return alert("Enter a category name.");

  try {
    const result = state.editingCategoryId
      ? await supabase.from("categories").update({ name }).eq("id", state.editingCategoryId)
      : await supabase.from("categories").insert({ name });
    if (result.error) throw new Error(result.error.message);

    alert(state.editingCategoryId ? "Category updated successfully." : "Category added successfully.");
    resetCategoryForm();
    await loadCategories();
  } catch (error) {
    console.error(error);
    alert(`Category save failed: ${error.message}`);
  }
}

async function deleteCategory(id) {
  const c = state.categories.find(x => x.id === id);
  if (!c || !confirm(`Delete category "${c.name}"? Products will remain but their category will become empty.`)) return;
  try {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await loadCategories();
    await loadProducts();
  } catch (error) {
    alert(`Category delete failed: ${error.message}`);
  }
}

(async () => {
  try {
    const user = await requireAdmin();
    if (!user) return;
    await loadCategories();
    await loadProducts();
  } catch (error) {
    console.error(error);
    alert(error.message || "Admin panel could not load.");
  }

  $("logoutBtn").onclick = async () => {
    await supabase.auth.signOut();
    location.href = "./login.html";
  };
  $("productForm").onsubmit = saveProduct;
  $("cancelProductEdit").onclick = resetProductForm;
  $("categoryForm").onsubmit = saveCategory;
  $("cancelCategoryEdit").onclick = resetCategoryForm;
})();
