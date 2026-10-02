import { getCart, getCartCount, setCartQuantity, removeFromCart, cartSubtotal } from "./cart.js";
import { money, esc, renderStoreChrome } from "./site.js";

const $ = id => document.getElementById(id);
export function renderBag() {
  const cart = getCart();
  const wrap = $("bagItems");
  if (!wrap) return;
  wrap.innerHTML = cart.length ? cart.map(i => `<div class="bag-item">
    <div class="bag-img">${i.image_url ? `<img src="${esc(i.image_url)}" alt="">` : "Y"}</div>
    <div class="bag-main"><strong>${esc(i.name)}</strong><span>${money(i.price)}</span>
      <div class="qty-row"><button type="button" data-dec="${i.id}">−</button><b>${i.quantity}</b><button type="button" data-inc="${i.id}">+</button><button class="remove-link" type="button" data-remove="${i.id}">Remove</button></div>
    </div>
  </div>`).join("") : `<div class="empty-bag"><div class="empty-icon">🛍</div><h3>Your bag is empty</h3><p>Add your favourite items and continue to checkout.</p></div>`;
  $("bagTotal").textContent = money(cartSubtotal());
  document.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => { const i = cart.find(x => x.id === b.dataset.inc); setCartQuantity(i.id, i.quantity + 1); renderBag(); });
  document.querySelectorAll("[data-dec]").forEach(b => b.onclick = () => { const i = cart.find(x => x.id === b.dataset.dec); setCartQuantity(i.id, i.quantity - 1); renderBag(); });
  document.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => { removeFromCart(b.dataset.remove); renderBag(); });
  document.querySelectorAll("[data-cart-count]").forEach(el => el.textContent = getCartCount());
}
export function bindBag() {
  $("bagButton")?.addEventListener("click", () => { $("bagDrawer").classList.add("open"); renderBag(); });
  $("closeBag")?.addEventListener("click", () => $("bagDrawer").classList.remove("open"));
  $("bagOverlay")?.addEventListener("click", () => $("bagDrawer").classList.remove("open"));
  renderBag();
  window.addEventListener("cart:updated", renderBag);
}
document.addEventListener("DOMContentLoaded", bindBag);
