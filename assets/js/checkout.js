import { supabase } from "./supabase.js";
import { getCart, saveCart, clearCart, cartSubtotal, setCartQuantity, f2 } from "./cart.js";
import { esc, money, renderStoreChrome } from "./site.js";

const $ = id => document.getElementById(id);

function render() {
  const cart = getCart();
  $("checkoutItems").innerHTML = cart.length
    ? cart.map(i => `<div class="checkout-item"><div><strong>${esc(i.name)}</strong><span>${money(i.price)}${i.unit === "kg" ? " / kg" : ""} × <input class="qin" type="number" min="${i.step || 1}" step="${i.step || 1}" value="${i.quantity}" data-qty="${esc(i.id)}">${i.unit === "kg" ? " kg" : ""}</span></div><b>${money(f2(i.quantity * i.price))}</b></div>`).join("")
    : `<div class="empty-bag"><h3>Your bag is empty</h3><a class="btn btn-primary" href="products.html">Browse Products</a></div>`;
  $("checkoutItems").querySelectorAll("[data-qty]").forEach(inp => inp.onchange = () => {
    const it = getCart().find(x => x.id === inp.dataset.qty); if (!it) return;
    const v = Number(inp.value) || 0;
    setCartQuantity(it.id, it.unit === "kg" ? v : Math.round(v));
  });
  const sub = cartSubtotal(), f = cart.length ? fee() : 0;
  $("feeLines").innerHTML = cart.length ? `<div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${money(sub)}</span></div><div style="display:flex;justify-content:space-between"><span>Delivery</span><span>${f ? money(f) : "Free"}</span></div>${Number(cfg.min_order) > sub ? `<div style="color:var(--red)">Minimum order is ${money(cfg.min_order)}</div>` : ""}` : "";
  $("areaField").hidden = !((cfg.delivery_zones || []).length && $("paymentMethod").value !== "Cash on Pickup");
  $("checkoutTotal").textContent = money(sub + f);
  $("placeOrder").disabled = !cart.length || cfg.accepting_orders === false;
}
let cfg = { delivery_fee: 0, free_delivery_above: 0, min_order: 0, delivery_zones: [], accepting_orders: true };
function fee() {
  if ($("paymentMethod").value === "Cash on Pickup") return 0;
  let f = Number(cfg.delivery_fee || 0); const z = cfg.delivery_zones || [];
  if (z.length) { const a = z.find(x => x.name === $("deliveryArea").value); if (a) f = Number(a.fee); }
  if (Number(cfg.free_delivery_above) > 0 && cartSubtotal() >= Number(cfg.free_delivery_above)) f = 0;
  return f;
}
async function loadCfg() {
  const { data } = await supabase.from("store_settings").select("*").eq("id", 1).maybeSingle();
  if (data) cfg = data;
  const z = Array.isArray(cfg.delivery_zones) ? cfg.delivery_zones : [];
  $("deliveryArea").innerHTML = z.map(x => `<option value="${esc(x.name)}">${esc(x.name)} - ${money(x.fee)}</option>`).join("");
  if (cfg.accepting_orders === false) { const n = $("syncNote"); n.hidden = false; n.textContent = "The store is not taking online orders right now. Please contact us on WhatsApp."; }
}

// Refresh prices / availability from the database so the customer sees the real total.
async function syncCart() {
  const cart = getCart();
  if (!cart.length) return;
  const { data, error } = await supabase.from("products").select("id,name,price,sale_price,is_available,unit,qty_step").in("id", cart.map(i => i.id));
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
    const u = p.unit || "pcs", st = u === "kg" ? Number(p.qty_step) || 0.5 : 1;
    if (i.unit !== u || i.step !== st) { i.unit = u; i.step = st; changed = true; }
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
  await Promise.all([syncCart(), loadCfg()]);
  render();
  ["paymentMethod", "deliveryArea"].forEach(id => $(id).addEventListener("change", render));
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
      payment_method: $("paymentMethod").value, delivery_area: $("deliveryArea").value || "",
      items: cart.map(i => ({ product_id: i.id, quantity: i.quantity }))
    };
    if (!payload.customer_name || !payload.phone || !payload.address) return alert("Please fill your name, phone and delivery address.");
    if (payload.phone.replace(/\D/g, "").length < 7) return alert("Please enter a valid phone number.");

    if (Number(cfg.min_order) > cartSubtotal()) return alert(`Minimum order is ${money(cfg.min_order)}.`);
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
