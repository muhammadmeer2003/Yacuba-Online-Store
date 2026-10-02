const KEY = "yacuba_cart_v2";

export function getCart() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveCart(cart) {
  localStorage.setItem(KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("cart:updated"));
}
export function getCartCount() { return getCart().reduce((n, i) => n + Number(i.quantity || 0), 0); }
export function clearCart() { saveCart([]); }
export function cartSubtotal() { return getCart().reduce((n, i) => n + Number(i.price || 0) * Number(i.quantity || 0), 0); }

export function addToCart(product, quantity = 1) {
  const cart = getCart();
  const price = Number(product.sale_price ?? product.price ?? 0);
  const existing = cart.find(i => i.id === product.id);
  if (existing) existing.quantity += quantity;
  else cart.push({
    id: product.id,
    name: product.name,
    image_url: product.image_url || "",
    price,
    quantity,
    category_name: product.category_name || ""
  });
  saveCart(cart);
}

export function setCartQuantity(id, quantity) {
  const cart = getCart().map(i => i.id === id ? {...i, quantity: Math.max(0, quantity)} : i).filter(i => i.quantity > 0);
  saveCart(cart);
}
export function removeFromCart(id) { saveCart(getCart().filter(i => i.id !== id)); }
