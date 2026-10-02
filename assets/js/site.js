import { STORE } from "./config.js";

const setText = (selector, value) => {
  document.querySelectorAll(selector).forEach(el => {
    el.textContent = value || "";
  });
};

const setHref = (selector, value) => {
  document.querySelectorAll(selector).forEach(el => {
    if (value) el.href = value;
  });
};

const normalizePhone = phone => (phone || "").replace(/\D/g, "");

function ensureCountryCode(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return "";
  if (digits.startsWith("63")) return digits;
  if (digits.startsWith("0")) return `63${digits.slice(1)}`;
  return digits;
}

document.addEventListener("DOMContentLoaded", () => {
  setText("[data-store-name]", STORE.MART_NAME);
  setText("[data-store-tagline]", STORE.MART_TAGLINE);
  setText("[data-store-phone]", STORE.MART_PHONE);
  setText("[data-store-address]", STORE.MART_ADDRESS);
  setText("[data-store-email]", STORE.MART_EMAIL);

  setHref("[data-store-instagram]", STORE.MART_INSTAGRAM);
  setHref("[data-store-facebook]", STORE.MART_FACEBOOK);

  document.querySelectorAll("[data-store-phone-link]").forEach(el => {
    const phone = normalizePhone(STORE.MART_PHONE);
    if (phone) {
      el.href = `tel:${phone}`;
      el.textContent = STORE.MART_PHONE;
    }
  });

  document.querySelectorAll("[data-store-whatsapp]").forEach(el => {
    const wa = ensureCountryCode(STORE.MART_WHATSAPP);
    if (wa) {
      el.href = `https://wa.me/${wa}`;
      if (!el.dataset.keepText) el.textContent = "Chat on WhatsApp";
    }
  });

  document.querySelectorAll("[data-store-email-link]").forEach(el => {
    if (STORE.MART_EMAIL) {
      el.href = `mailto:${STORE.MART_EMAIL}`;
      el.textContent = STORE.MART_EMAIL;
    }
  });

  document.querySelectorAll("[data-store-logo]").forEach(img => {
    if (STORE.MART_LOGO) {
      img.src = STORE.MART_LOGO;
      img.alt = STORE.MART_NAME;
    } else {
      img.style.display = "none";
    }
  });
});
