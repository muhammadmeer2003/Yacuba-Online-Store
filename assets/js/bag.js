import { getCart, getCartCount, setCartQuantity, removeFromCart, cartSubtotal } from "./cart.js";
import { money, esc } from "./site.js";

const $ = id => document.getElementById(id);

export function renderBag() {
  const wrap = $("bagItems");
  if (!wrap) return;
  const cart = getCart();
  wrap.innerHTML = cart.length ? cart.map(i => `<div class="bag-item">
    <div class="bag-img">${i.image_url ? `<img src="${esc(i.image_url)}" alt="">` : "Y"}</div>
    <div class="bag-main"><strong>${esc(i.name)}</strong><span>${money(i.price)}${i.unit === "kg" ? " / kg" : ""}</span>
      <div class="qty-row"><button type="button" data-dec="${esc(i.id)}" aria-label="Decrease quantity">−</button><b>${i.quantity}${i.unit === "kg" ? " kg" : ""}</b><button type="button" data-inc="${esc(i.id)}" aria-label="Increase quantity">+</button><button class="remove-link" type="button" data-remove="${esc(i.id)}">Remove</button></div>
    </div>
  </div>`).join("") : `<div class="empty-bag"><div class="empty-icon">🛍</div><h3>Your bag is empty</h3><p>Add your favourite items and continue to checkout.</p></div>`;
  if ($("bagTotal")) $("bagTotal").textContent = money(cartSubtotal());
  const checkoutBtn = document.querySelector(".bag-foot .btn");
  if (checkoutBtn) { checkoutBtn.style.opacity = cart.length ? "1" : ".45"; checkoutBtn.style.pointerEvents = cart.length ? "auto" : "none"; }
  wrap.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => { const i = getCart().find(x => x.id === b.dataset.inc); if (i) setCartQuantity(i.id, i.quantity + (i.step || 1)); });
  wrap.querySelectorAll("[data-dec]").forEach(b => b.onclick = () => { const i = getCart().find(x => x.id === b.dataset.dec); if (i) setCartQuantity(i.id, i.quantity - (i.step || 1)); });
  wrap.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => removeFromCart(b.dataset.remove));
  document.querySelectorAll("[data-cart-count]").forEach(el => el.textContent = getCartCount());
}

function openBag() { $("bagDrawer")?.classList.add("open"); renderBag(); }
function closeBag() { $("bagDrawer")?.classList.remove("open"); }

export function bindBag() {
  if (!$("bagDrawer")) return;
  $("bagButton")?.addEventListener("click", e => { e.preventDefault(); openBag(); });
  $("closeBag")?.addEventListener("click", closeBag);
  $("bagOverlay")?.addEventListener("click", closeBag);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeBag(); });
  window.addEventListener("cart:updated", renderBag);
  renderBag();
}
document.addEventListener("DOMContentLoaded", bindBag);
