import { STORE } from "./config.js";
import { getCartCount } from "./cart.js";

const digits = value => String(value || "").replace(/\D/g, "");
const money = value => `₱${Number(value || 0).toLocaleString("en-PH", {minimumFractionDigits:2, maximumFractionDigits:2})}`;

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function renderStoreChrome() {
  document.querySelectorAll("[data-store-name]").forEach(el => el.textContent = STORE.MART_NAME);
  document.querySelectorAll("[data-store-tagline]").forEach(el => el.textContent = STORE.MART_TAGLINE);
  document.querySelectorAll("[data-store-phone]").forEach(el => el.textContent = STORE.MART_PHONE);
  document.querySelectorAll("[data-store-address]").forEach(el => el.textContent = STORE.MART_ADDRESS);
  document.querySelectorAll("[data-store-email]").forEach(el => el.textContent = STORE.MART_EMAIL);
  document.querySelectorAll("[data-store-phone-link]").forEach(el => el.href = `tel:${digits(STORE.MART_PHONE)}`);
  document.querySelectorAll("[data-store-whatsapp]").forEach(el => el.href = `https://wa.me/${digits(STORE.MART_WHATSAPP || STORE.MART_PHONE)}`);
  document.querySelectorAll("[data-store-email-link]").forEach(el => el.href = `mailto:${STORE.MART_EMAIL}`);
  document.querySelectorAll("[data-store-instagram]").forEach(el => el.href = STORE.MART_INSTAGRAM || "#");
  document.querySelectorAll("[data-store-facebook]").forEach(el => el.href = STORE.MART_FACEBOOK || "#");
  document.querySelectorAll("[data-store-logo]").forEach(img => {
    if (STORE.MART_LOGO) { img.src = STORE.MART_LOGO; img.alt = STORE.MART_NAME; img.hidden = false; }
    else img.hidden = true;
  });
  document.querySelectorAll("[data-money]").forEach(el => el.textContent = money(el.dataset.money));
  document.querySelectorAll("[data-cart-count]").forEach(el => el.textContent = getCartCount());
}

document.addEventListener("DOMContentLoaded", () => {
  renderStoreChrome();
  window.addEventListener("cart:updated", () => renderStoreChrome());
});

export { money };
