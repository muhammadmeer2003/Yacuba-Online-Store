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
export function getCartCount() { return getCart().reduce((n, i) => n + Number(i.quantity || 0), 0); }
export function clearCart() { saveCart([]); }
export function cartSubtotal() { return getCart().reduce((n, i) => n + Number(i.price || 0) * Number(i.quantity || 0), 0); }

export function addToCart(product, quantity = 1) {
  const cart = getCart();
  const price = Number(product.sale_price ?? product.price ?? 0);
  const existing = cart.find(i => i.id === product.id);
  if (existing) { existing.quantity = Math.min(MAX_QTY, existing.quantity + quantity); existing.price = price; }
  else cart.push({
    id: product.id,
    name: product.name,
    image_url: product.image_url || "",
    price,
    quantity: Math.min(MAX_QTY, quantity),
    category_name: product.category_name || ""
  });
  saveCart(cart);
}

export function setCartQuantity(id, quantity) {
  const q = Math.min(MAX_QTY, Math.max(0, quantity));
  saveCart(getCart().map(i => i.id === id ? {...i, quantity: q} : i).filter(i => i.quantity > 0));
}
export function removeFromCart(id) { saveCart(getCart().filter(i => i.id !== id)); }
