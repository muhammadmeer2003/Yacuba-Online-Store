import { STORE } from "./config.js";

const setText = (selector, value) => document.querySelectorAll(selector).forEach(el => el.textContent = value || "");
const setHref = (selector, value) => document.querySelectorAll(selector).forEach(el => { if (value) el.href = value; });

document.addEventListener("DOMContentLoaded", () => {
  setText("[data-store-name]", STORE.MART_NAME);
  setText("[data-store-tagline]", STORE.MART_TAGLINE);
  setText("[data-store-phone]", STORE.MART_PHONE);
  setText("[data-store-address]", STORE.MART_ADDRESS);
  setText("[data-store-email]", STORE.MART_EMAIL);
  setHref("[data-store-instagram]", STORE.MART_INSTAGRAM);
  setHref("[data-store-facebook]", STORE.MART_FACEBOOK);

  document.querySelectorAll("[data-store-whatsapp]").forEach(el => {
    const digits = (STORE.MART_WHATSAPP || "").replace(/\D/g, "");
    if (digits) el.href = `https://wa.me/${digits}`;
  });

  document.querySelectorAll("[data-store-phone-link]").forEach(el => {
    el.href = `tel:${(STORE.MART_PHONE || "").replace(/\s+/g, "")}`;
  });

  document.querySelectorAll("[data-store-logo]").forEach(img => {
    if (STORE.MART_LOGO) {
      img.src = STORE.MART_LOGO;
      img.alt = STORE.MART_NAME;
    }
  });
});
