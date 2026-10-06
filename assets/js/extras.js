import { supabase } from "./supabase.js";
import { STORE } from "./config.js";
import { esc, money } from "./site.js";
import { S, calc, all } from "./inventory.js";
import { doPrint } from "./ops.js";
const $ = id => document.getElementById(id);
const n = v => Number(v || 0);
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const CATS = ["Rent", "Salaries", "Electricity / Water", "Transport / Fuel", "Packaging", "Marketing", "Repairs", "Other"];
let pend = 0, last = null;

// ---------- Expenses section
document.querySelector(".admin-main").insertAdjacentHTML("beforeend", `<section class="admin-view" id="expView" hidden><div class="panel"><div class="panel-head"><h2>Expenses</h2><input id="expMonth" type="month" class="small-input"></div>
<form id="expForm" class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))"><label>Date<input id="expDate" type="date" required></label><label>Category<select id="expCat">${CATS.map(c => `<option>${c}</option>`).join("")}</select></label><label>Details<input id="expDesc" placeholder="optional"></label><label>Amount (₱)<input id="expAmt" type="number" min="0.01" step="0.01" required></label><button class="btn btn-primary">Add Expense</button></form>
<p id="expTotal" style="font-size:18px;margin:16px 0 6px"></p><div class="data-list" id="expList"></div></div></section>`);
async function loadExp() {
  const m = $("expMonth").value, [y, mo] = m.split("-").map(Number), nxt = new Date(y, mo, 1), end = `${nxt.getFullYear()}-${String(nxt.getMonth() + 1).padStart(2, "0")}-01`;
  const { data, error } = await supabase.from("expenses").select("*").gte("expense_date", m + "-01").lt("expense_date", end).order("expense_date", { ascending: false });
  if (error) { $("expList").innerHTML = `<div class="empty-admin">Run supabase/phase1_v6.sql first.<br><small>${esc(error.message)}</small></div>`; return; }
  $("expTotal").innerHTML = `Total this month: <b>${money((data || []).reduce((t, x) => t + n(x.amount), 0))}</b>`;
  $("expList").innerHTML = (data || []).map(x => `<div class="data-row"><div class="grow"><strong>${x.expense_date} · ${esc(x.category)}</strong><span>${esc(x.description || "")}</span></div><b>${money(x.amount)}</b><button class="small-btn danger" data-delexp="${x.id}">Delete</button></div>`).join("") || `<div class="empty-admin">No expenses this month.</div>`;
  document.querySelectorAll("[data-delexp]").forEach(b => b.onclick = async () => { if (!confirm("Delete this expense?")) return; await supabase.from("expenses").delete().eq("id", b.dataset.delexp); loadExp(); });
}

// ---------- Dashboard: needs attention
$("overview").insertAdjacentHTML("beforeend", `<div class="panel" id="attention" style="grid-column:1/-1"><div class="panel-head"><h2>Needs attention</h2></div><div id="attBody" class="muted">Loading...</div></div>`);
function drawAttention() {
  const c = Object.values(calc()), lim = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), t = today();
  const low = c.filter(x => x.stock <= n(x.i.reorder_level)).slice(0, 8);
  const im = new Map(c.map(x => [x.i.id, x]));
  const exp = S.moves.filter(m => m.movement_type === "purchase" && m.expiry_date && m.expiry_date <= lim && (im.get(m.item_id)?.stock || 0) > 0).sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)).slice(0, 8);
  const lb = +localStorage.getItem("yacuba_last_backup") || 0, days = lb ? Math.floor((Date.now() - lb) / 864e5) : null;
  const row = t => `<div style="padding:6px 0;border-bottom:1px solid var(--line)">${t}</div>`;
  $("attBody").innerHTML =
    row(pend ? `🔔 <b>${pend}</b> pending order(s) <button class="small-btn" id="goOrders">Open Orders</button>` : "✅ No pending orders") +
    row(days === null || days >= 7 ? `⚠ ${days === null ? "No backup taken yet" : `Last backup ${days} days ago`}. <button class="small-btn" id="goBackup">Take backup</button>` : `✅ Last backup ${days} day(s) ago`) +
    row("<b>Low / out of stock</b>" + (low.length ? low.map(x => `<br>${esc(x.i.sku)} · ${esc(x.i.name)} — ${Number(x.stock.toFixed(2))} ${esc(x.i.unit)} left`).join("") : "<br>All good")) +
    row("<b>Expiring within 30 days (or expired)</b>" + (exp.length ? exp.map(m => `<br>${esc(im.get(m.item_id)?.i.name || "")} — ${m.expiry_date}${m.expiry_date < t ? " <span class='neg'>EXPIRED</span>" : ""} (batch of ${Number(n(m.quantity).toFixed(2))})`).join("") : "<br>Nothing expiring soon"));
  $("goOrders")?.addEventListener("click", () => document.querySelector('[data-section="ordersView"]').click());
  $("goBackup")?.addEventListener("click", () => document.querySelector('[data-section="settingsView"]').click());
}
document.addEventListener("inv:loaded", drawAttention);

// ---------- New order alert (checks every 30 seconds while admin is open)
function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.3].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(0.25, a.currentTime + t); o.start(a.currentTime + t); o.stop(a.currentTime + t + 0.2); }); } catch {} }
function toast(msg) { let t = $("adminToast"); if (!t) { t = document.createElement("div"); t.id = "adminToast"; t.className = "toast"; document.body.appendChild(t); } t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 7000); }
async function poll() {
  const { count, error } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "Pending");
  if (error) return; pend = count || 0;
  document.querySelector('[data-section="ordersView"]').dataset.n = pend || "";
  document.title = `${pend ? `(${pend}) ` : ""}YACUBA Admin`;
  if (last !== null && pend > last) { beep(); toast("🔔 New order received!"); document.dispatchEvent(new Event("orders:refresh")); }
  last = pend; drawAttention();
}

// ---------- Print delivery slip for an order
const slip = o => `<div class="rcpt"><h3>${esc(STORE.MART_NAME)}</h3><div style="text-align:center">DELIVERY SLIP</div><hr><div><b>${esc(o.order_number)}</b><br>${new Date(o.created_at).toLocaleString()}<br><b>${esc(o.customer_name)}</b><br>Tel: ${esc(o.phone)}${o.whatsapp ? `<br>WA: ${esc(o.whatsapp)}` : ""}<br>${esc(o.address)}${o.delivery_area ? `<br>Area: ${esc(o.delivery_area)}` : ""}${o.notes ? `<br>Note: ${esc(o.notes)}` : ""}</div><hr><table>${(o.items || []).map(i => `<tr><td colspan="2">${esc(i.name)}</td></tr><tr><td>${i.quantity}${i.unit === "kg" ? " kg" : ""} x ${n(i.unit_price).toFixed(2)}</td><td class="r">${(n(i.quantity) * n(i.unit_price)).toFixed(2)}</td></tr>`).join("")}</table><hr><table><tr><td>Subtotal</td><td class="r">${n(o.subtotal).toFixed(2)}</td></tr><tr><td>Delivery</td><td class="r">${n(o.delivery_fee).toFixed(2)}</td></tr><tr><td><b>TOTAL</b></td><td class="r"><b>${money(o.total_amount)}</b></td></tr></table><div>${esc(o.payment_method || "")}</div><hr><div style="text-align:center">Thank you!</div></div>`;
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-slip]"); if (!b) return;
  const { data, error } = await supabase.from("orders").select("*").eq("id", b.dataset.slip).single();
  if (error) return alert(error.message); doPrint(slip(data), true);
});

// ---------- Backup
const TABLES = ["products", "categories", "orders", "inventory_items", "stock_movements", "expenses", "reviews", "feedback", "site_banners", "store_settings"];
async function dump(t) { for (const o of ["created_at", "id"]) { try { return await all(t, o); } catch {} } return []; }
function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type })); a.download = name; a.click(); }
function csv(rows) { const cols = [...new Set(rows.flatMap(r => Object.keys(r)))]; const q = v => `"${(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)).replace(/"/g, '""')}"`; return [cols.map(q).join(",")].concat(rows.map(r => cols.map(c => q(r[c])).join(","))).join("\r\n"); }
$("settingsView").insertAdjacentHTML("beforeend", `<div class="panel"><div class="panel-head"><h2>Backup & Export</h2></div><p class="muted">Download a copy of your data regularly (at least once a week) and keep it on your computer or Google Drive.</p><div class="row-actions"><button class="btn btn-primary" id="bkJson">Full backup (JSON)</button><button class="btn btn-secondary" data-csv="products">Products CSV</button><button class="btn btn-secondary" data-csv="orders">Orders CSV</button><button class="btn btn-secondary" data-csv="inventory_items">Inventory CSV</button><button class="btn btn-secondary" data-csv="expenses">Expenses CSV</button></div></div>`);
$("bkJson").onclick = async () => {
  const out = {}; for (const t of TABLES) out[t] = await dump(t);
  download(`yacuba-backup-${today()}.json`, JSON.stringify(out, null, 1), "application/json");
  localStorage.setItem("yacuba_last_backup", Date.now()); drawAttention();
};
document.querySelectorAll("[data-csv]").forEach(b => b.onclick = async () => download(`yacuba-${b.dataset.csv}-${today()}.csv`, csv(await dump(b.dataset.csv)), "text/csv"));

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession(); if (!session) return;
  $("expDate").value = today(); $("expMonth").value = today().slice(0, 7); $("expMonth").onchange = loadExp;
  $("expForm").onsubmit = async e => { e.preventDefault(); const { error } = await supabase.from("expenses").insert({ expense_date: $("expDate").value, category: $("expCat").value, description: $("expDesc").value.trim() || null, amount: n($("expAmt").value) }); if (error) return alert(error.message); $("expDesc").value = ""; $("expAmt").value = ""; loadExp(); };
  loadExp(); poll(); setInterval(poll, 30000);
});
