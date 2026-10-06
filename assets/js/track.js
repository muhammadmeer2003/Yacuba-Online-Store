import { supabase } from "./supabase.js";
import { renderStoreChrome, esc } from "./site.js";
const $ = id => document.getElementById(id);
async function go() {
  const no = $("trkNo").value.trim(); if (!no) return;
  $("trkOut").textContent = "Checking...";
  const { data, error } = await supabase.rpc("track_order", { order_no: no });
  $("trkOut").innerHTML = (!error && data && data.status) ? `Order <b>${esc(no.toUpperCase())}</b> status: <b>${esc(data.status)}</b>` : "Order not found. Please check the number.";
}
document.addEventListener("DOMContentLoaded", () => {
  renderStoreChrome();
  const q = new URLSearchParams(location.search).get("order"); if (q) { $("trkNo").value = q; go(); }
  $("trkForm").onsubmit = e => { e.preventDefault(); go(); };
});
