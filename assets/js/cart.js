const KEY = "yacuba_cart_v2";
const MAX_QTY = 99;

export function getCart() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(c) ? c : [];
  } catch { return []; }
}
export function saveCart(cart) {
  try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch {}
  window.dispatchEvent(new CustomEvent("cart:updated"));
}
export function getCartCount() { return getCart().reduce((n, i) => n + Math.ceil(Number(i.quantity || 0)), 0); }
export function clearCart() { saveCart([]); }
export const f2 = v => Math.round(Number(v || 0) * 100) / 100;
export const isKg = p => p.unit === "kg";
export const stepOf = p => isKg(p) ? (Number(p.qty_step) || 0.5) : 1;
export function cartSubtotal() { return f2(getCart().reduce((n, i) => n + f2(Number(i.price || 0) * Number(i.quantity || 0)), 0)); }
// Weight box for kg products: customer types kg, amount updates live
export function weightBox(p) {
  if (!isKg(p)) return "";
  const s = stepOf(p), price = Number(p.sale_price ?? p.price ?? 0);
  return `<div class="kg-row"><input class="kg-in" type="number" min="${s}" step="${s}" value="1" data-kg="${p.id}" data-price="${price}" aria-label="Weight in kg"><span>kg</span><b data-amt="${p.id}">₱${price.toFixed(2)}</b></div>`;
}
export function wireWeight() {
  document.querySelectorAll("[data-kg]").forEach(i => i.oninput = () => {
    const a = document.querySelector(`[data-amt="${i.dataset.kg}"]`);
    if (a) a.textContent = "₱" + f2(Number(i.value || 0) * Number(i.dataset.price)).toFixed(2);
  });
}
export function chosenQty(p) {
  if (!isKg(p)) return 1;
  const s = stepOf(p), i = document.querySelector(`[data-kg="${p.id}"]`);
  return Math.max(s, f2(Number(i?.value) || s));
}

export function addToCart(product, quantity = 1) {
  const cart = getCart();
  const price = Number(product.sale_price ?? product.price ?? 0);
  const existing = cart.find(i => i.id === product.id);
  if (existing) { existing.quantity = Math.min(MAX_QTY, f2(existing.quantity + quantity)); existing.price = price; }
  else cart.push({
    id: product.id,
    name: product.name,
    image_url: product.image_url || "",
    price,
    quantity: Math.min(MAX_QTY, f2(quantity)),
    unit: product.unit || "pcs",
    step: stepOf(product),
    category_name: product.category_name || ""
  });
  saveCart(cart);
}

export function setCartQuantity(id, quantity) {
  const q = Math.min(MAX_QTY, Math.max(0, f2(quantity)));
  saveCart(getCart().map(i => i.id === id ? {...i, quantity: q} : i).filter(i => i.quantity > 0));
}
export function removeFromCart(id) { saveCart(getCart().filter(i => i.id !== id)); }
