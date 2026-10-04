import { supabase } from "./supabase.js";
import { STORE } from "./config.js";
import { renderStoreChrome, money } from "./site.js";

const $ = id => document.getElementById(id);
const digits = v => String(v || "").replace(/\D/g, "");

document.addEventListener("DOMContentLoaded", async () => {
  renderStoreChrome();
  const params = new URLSearchParams(location.search);
  const n = params.get("order");
  const total = params.get("total");
  $("orderNumber").textContent = n || "Your order";

  // Let the customer send the order number to the store on WhatsApp.
  const wa = $("waOrder");
  if (wa && n) {
    const text = `Hello ${STORE.MART_NAME}! I just placed order ${n}${total ? ` (total ${money(total)})` : ""}.`;
    wa.href = `https://wa.me/${digits(STORE.MART_WHATSAPP || STORE.MART_PHONE)}?text=${encodeURIComponent(text)}`;
    wa.hidden = false;
  }

  // Status lookup uses a safe RPC (orders table itself is admin-only).
  if (n) {
    try {
      const { data, error } = await supabase.rpc("track_order", { order_no: n });
      if (!error && data && data.status) $("orderStatus").textContent = `Status: ${data.status}`;
    } catch {}
  }
});
