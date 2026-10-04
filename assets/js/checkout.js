import { supabase } from "./supabase.js";
import { getCart, saveCart, clearCart, cartSubtotal } from "./cart.js";
import { esc, money, renderStoreChrome } from "./site.js";

const $ = id => document.getElementById(id);

function render() {
  const cart = getCart();
  $("checkoutItems").innerHTML = cart.length
    ? cart.map(i => `<div class="checkout-item"><div><strong>${esc(i.name)}</strong><span>${i.quantity} × ${money(i.price)}</span></div><b>${money(i.quantity * i.price)}</b></div>`).join("")
    : `<div class="empty-bag"><h3>Your bag is empty</h3><a class="btn btn-primary" href="products.html">Browse Products</a></div>`;
  $("checkoutTotal").textContent = money(cartSubtotal());
  $("placeOrder").disabled = !cart.length;
}

// Refresh prices / availability from the database so the customer sees the real total.
async function syncCart() {
  const cart = getCart();
  if (!cart.length) return;
  const { data, error } = await supabase.from("products").select("id,name,price,sale_price,is_available").in("id", cart.map(i => i.id));
  if (error || !data) return;
  const map = new Map(data.map(p => [p.id, p]));
  const removed = [];
  let changed = false;
  const fresh = [];
  for (const i of cart) {
    const p = map.get(i.id);
    if (!p || !p.is_available) { removed.push(i.name); changed = true; continue; }
    const price = Number(p.sale_price ?? p.price ?? 0);
    if (price !== Number(i.price)) { i.price = price; changed = true; }
    fresh.push(i);
  }
  if (changed) saveCart(fresh);
  if (removed.length) {
    const note = $("syncNote");
    if (note) { note.hidden = false; note.textContent = `Removed (no longer available): ${removed.join(", ")}`; }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  renderStoreChrome();
  render();
  await syncCart();
  render();
  window.addEventListener("cart:updated", render);

  $("checkoutForm").addEventListener("submit", async e => {
    e.preventDefault();
    const cart = getCart();
    if (!cart.length) return;
    const payload = {
      customer_name: $("customerName").value.trim(),
      phone: $("customerPhone").value.trim(),
      whatsapp: $("customerWhatsApp").value.trim(),
      address: $("customerAddress").value.trim(),
      notes: $("orderNotes").value.trim(),
      payment_method: $("paymentMethod").value,
      items: cart.map(i => ({ product_id: i.id, quantity: i.quantity }))
    };
    if (!payload.customer_name || !payload.phone || !payload.address) return alert("Please fill your name, phone and delivery address.");
    if (payload.phone.replace(/\D/g, "").length < 7) return alert("Please enter a valid phone number.");

    const btn = $("placeOrder");
    btn.disabled = true; btn.textContent = "Placing order...";
    try {
      const { data, error } = await supabase.rpc("place_order", { order_payload: payload });
      if (error) throw error;
      clearCart();
      location.href = `order-success.html?order=${encodeURIComponent(data.order_number)}&total=${encodeURIComponent(data.total ?? "")}`;
    } catch (err) {
      console.error(err);
      alert(`Order could not be placed: ${err.message}`);
      btn.disabled = false; btn.textContent = "Place Order";
    }
  });
});
