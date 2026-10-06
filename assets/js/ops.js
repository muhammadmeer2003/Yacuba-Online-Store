import { supabase } from "./supabase.js";
import { STORE } from "./config.js";
import { esc, money } from "./site.js";
import { S, calc, load } from "./inventory.js";
const $ = id => document.getElementById(id);
const n = v => Number(v || 0), f2 = v => Number(n(v).toFixed(2)), today = () => new Date().toISOString().slice(0, 10);
let cfg = { receipt_footer: "Thank you for shopping with us!" };
const find = code => { const c = String(code).trim().toUpperCase(); return c && S.items.find(i => (i.barcode && i.barcode.toUpperCase() === c) || i.sku.toUpperCase() === c); };
const SCAN = id => `<div class="scanbox"><span>▌▌▌</span><input id="${id}" placeholder="Click here, then scan barcode (or type SKU + Enter)" autocomplete="off"></div>`;

export function doPrint(html, receipt) {
  $("printArea").innerHTML = html; let st;
  if (receipt) { st = document.createElement("style"); st.textContent = "@page{size:80mm auto;margin:3mm}"; document.head.appendChild(st); }
  document.body.classList.add("print-report");
  addEventListener("afterprint", () => { document.body.classList.remove("print-report"); st?.remove(); }, { once: true });
  setTimeout(() => window.print(), 60);
}
function receipt(title, ref, date, who, whoLabel, lines) {
  const tot = lines.reduce((t, l) => t + l.qty * l.price, 0);
  return `<div class="rcpt"><h3>${esc(STORE.MART_NAME)}</h3><div style="text-align:center">${esc(STORE.MART_ADDRESS)}<br>${esc(STORE.MART_PHONE)}</div><hr><div><b>${title}</b><br>Ref: ${esc(ref)}<br>Date: ${date} ${new Date().toLocaleTimeString()}${who ? `<br>${whoLabel}: ${esc(who)}` : ""}</div><hr><table>${lines.map(l => `<tr><td colspan="2">${esc(l.name)}</td></tr><tr><td>${l.qty} x ${f2(l.price).toFixed(2)}</td><td class="r">${(l.qty * l.price).toFixed(2)}</td></tr>`).join("")}</table><hr><table><tr><td><b>TOTAL</b></td><td class="r"><b>${money(tot)}</b></td></tr></table><hr><div style="text-align:center">${esc(cfg.receipt_footer || "")}</div></div>`;
}
const docSec = (id, title, who, ph, label) => `<section class="admin-view" id="${id}View" hidden><div class="panel"><div class="panel-head"><h2>${title}</h2></div>
<div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><label>${who}<input id="${id}Who" placeholder="${ph}"></label><label>Date<input id="${id}Date" type="date"></label><label>Reference / Invoice no.<input id="${id}Ref" placeholder="Auto if empty"></label></div>${SCAN(id + "Scan")}
<div class="rep-scroll"><table class="rep-table"><thead><tr><th>SKU</th><th>Item</th><th class="r">Qty</th><th class="r">${label}</th>${id === "rcv" ? '<th class="r">Expiry (optional)</th>' : ""}<th class="r">Total</th><th></th></tr></thead><tbody id="${id}Lines"></tbody></table></div>
<div class="panel-head"><b id="${id}Total"></b><div class="row-actions"><button class="btn btn-secondary" id="${id}Clear">Clear</button><button class="btn btn-secondary" id="${id}Save">Save</button><button class="btn btn-primary" id="${id}Print">Save & Print</button></div></div></div></section>`;

function doc(id, inn) {
  const L = [], el = s => $(id + s);
  const draw = () => {
    el("Lines").innerHTML = L.map((l, k) => `<tr><td>${esc(l.item.sku)}</td><td>${esc(l.item.name)}</td><td class="r"><input class="qin" type="number" step="0.01" min="0.01" value="${l.qty}" data-q="${k}"></td><td class="r"><input class="qin" type="number" step="0.01" min="0" value="${l.price}" data-p="${k}"></td>${inn ? `<td class="r"><input class="qin" style="width:135px" type="date" data-e="${k}" value="${l.exp || ""}"></td>` : ""}<td class="r">${money(l.qty * l.price)}</td><td><button class="small-btn danger" data-x="${k}">✕</button></td></tr>`).join("") || `<tr><td colspan="7" class="muted">Scan an item to begin.</td></tr>`;
    el("Total").textContent = "Total " + money(L.reduce((t, l) => t + l.qty * l.price, 0));
    el("Lines").querySelectorAll("[data-q]").forEach(i => i.onchange = () => { L[i.dataset.q].qty = n(i.value) || 1; draw(); });
    el("Lines").querySelectorAll("[data-p]").forEach(i => i.onchange = () => { L[i.dataset.p].price = n(i.value); draw(); });
    el("Lines").querySelectorAll("[data-e]").forEach(i => i.onchange = () => { L[i.dataset.e].exp = i.value; });
    el("Lines").querySelectorAll("[data-x]").forEach(b => b.onclick = () => { L.splice(b.dataset.x, 1); draw(); });
  };
  el("Scan").addEventListener("keydown", e => {
    if (e.key !== "Enter") return; e.preventDefault();
    const v = e.target.value.trim(); e.target.value = ""; if (!v) return;
    const it = find(v); if (!it) return alert(`Item not found: ${v}\nAdd it in Products / Inventory first.`);
    const ex = L.find(l => l.item.id === it.id);
    if (ex) ex.qty += 1; else L.push({ item: it, qty: 1, price: inn ? f2(calc()[it.id]?.avg) : n(it.sell_price) });
    draw();
  });
  const reset = () => { L.length = 0; ["Who", "Ref"].forEach(s => el(s).value = ""); el("Date").value = today(); draw(); el("Scan").focus(); };
  async function save(pr) {
    if (!L.length) return alert("Scan at least one item.");
    const date = el("Date").value || today(), who = el("Who").value.trim(), ref = el("Ref").value.trim() || `${inn ? "RCV" : "DSP"}-${date.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!inn) { const c = calc(), bad = L.filter(l => l.qty > (c[l.item.id]?.stock || 0)); if (bad.length && !confirm(`Not enough stock for: ${bad.map(b => b.item.name).join(", ")}. Continue?`)) return; }
    const { error } = await supabase.from("stock_movements").insert(L.map(l => ({ item_id: l.item.id, movement_type: inn ? "purchase" : "sale", movement_date: date, quantity: l.qty, unit_price: l.price, supplier: who || null, reference: ref, notes: inn ? "Receiving" : "Dispatch", expiry_date: inn ? (l.exp || null) : null })));
    if (error) return alert(error.message);
    if (pr) doPrint(receipt(inn ? "RECEIVING SLIP" : "SALES RECEIPT / DISPATCH", ref, date, who, inn ? "Supplier" : "Customer", L.map(l => ({ name: l.item.name, qty: l.qty, price: l.price }))), true);
    reset(); await load();
  }
  el("Clear").onclick = reset; el("Save").onclick = () => save(false); el("Print").onclick = () => save(true);
  reset();
}

// ---- Ending inventory (physical count)
const C = {};
function cnt() {
  const draw = () => {
    const c = Object.values(calc()); let val = 0, done = 0;
    $("cntLines").innerHTML = c.map(x => { const k = C[x.i.id], has = k != null; if (has) { val += k * x.avg; done++; }
      return `<tr><td>${esc(x.i.sku)}</td><td>${esc(x.i.name)}</td><td class="r">${f2(x.stock)}</td><td class="r"><input class="qin" type="number" step="0.01" data-c="${x.i.id}" value="${has ? k : ""}"></td><td class="r ${has && k - x.stock ? "neg" : ""}">${has ? f2(k - x.stock) : ""}</td><td class="r">${has ? money(k * x.avg) : ""}</td></tr>`; }).join("") || `<tr><td colspan="6" class="muted">No items yet.</td></tr>`;
    $("cntTotal").textContent = `Counted ${done} of ${c.length} items · Ending inventory value ${money(val)}`;
    $("cntLines").querySelectorAll("[data-c]").forEach(i => i.onchange = () => { if (i.value === "") delete C[i.dataset.c]; else C[i.dataset.c] = n(i.value); draw(); });
  };
  $("cntScan").addEventListener("keydown", e => {
    if (e.key !== "Enter") return; e.preventDefault(); const v = e.target.value.trim(); e.target.value = ""; if (!v) return;
    const it = find(v); if (!it) return alert(`Item not found: ${v}`); C[it.id] = (C[it.id] ?? 0) + 1; draw();
  });
  $("cntReset").onclick = () => { Object.keys(C).forEach(k => delete C[k]); draw(); };
  $("cntApply").onclick = async () => {
    const date = $("cntDate").value || today(), c = calc();
    const rows = Object.keys(C).map(id => ({ item_id: id, d: f2(C[id] - (c[id]?.stock || 0)) })).filter(r => r.d !== 0);
    if (!Object.keys(C).length) return alert("Nothing counted yet.");
    if (!rows.length) return alert("Counted stock matches the system. Nothing to adjust.");
    if (!confirm(`Adjust stock for ${rows.length} item(s) to match your count?`)) return;
    const { error } = await supabase.from("stock_movements").insert(rows.map(r => ({ item_id: r.item_id, movement_type: "adjustment", movement_date: date, quantity: r.d, unit_price: 0, reference: "COUNT-" + date, notes: "Ending inventory count" })));
    if (error) return alert(error.message); Object.keys(C).forEach(k => delete C[k]); await load();
  };
  $("cntPrint").onclick = () => {
    const date = $("cntDate").value || today(), c = Object.values(calc()).filter(x => C[x.i.id] != null); let tot = 0;
    const rows = c.map(x => { const k = C[x.i.id]; tot += k * x.avg; return `<tr><td>${esc(x.i.sku)}</td><td>${esc(x.i.name)}</td><td class="r">${f2(x.stock)}</td><td class="r">${f2(k)}</td><td class="r">${f2(k - x.stock)}</td><td class="r">${money(x.avg)}</td><td class="r">${money(k * x.avg)}</td></tr>`; }).join("");
    doPrint(`<div class="rep-head"><img src="../assets/img/logo-mark.png" alt=""><div><h2>${esc(STORE.MART_NAME)}</h2><p><b>Ending Inventory Count</b> · ${date}</p></div></div><table class="rep-table"><thead><tr><th>SKU</th><th>Item</th><th class="r">System</th><th class="r">Counted</th><th class="r">Variance</th><th class="r">Avg cost</th><th class="r">Value</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Nothing counted</td></tr>'}<tr class="tot"><td colspan="6">Ending inventory value</td><td class="r">${money(tot)}</td></tr></tbody></table>`);
  };
  $("cntDate").value = today(); draw(); document.addEventListener("inv:loaded", draw);
}

// ---- Settings
async function settings() {
  const { data } = await supabase.from("store_settings").select("*").eq("id", 1).maybeSingle();
  if (data) cfg = data;
  const z = Array.isArray(cfg.delivery_zones) ? cfg.delivery_zones : [];
  $("sOpen").checked = cfg.accepting_orders !== false; $("sFee").value = cfg.delivery_fee ?? 0; $("sFree").value = cfg.free_delivery_above ?? 0; $("sMin").value = cfg.min_order ?? 0;
  $("sZones").value = z.map(x => `${x.name} = ${x.fee}`).join("\n"); $("sFoot").value = cfg.receipt_footer || "";
  $("setForm").onsubmit = async e => {
    e.preventDefault();
    const zones = $("sZones").value.split("\n").map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(.*?)[=:]\s*([\d.]+)\s*$/); return m ? { name: m[1].trim(), fee: Number(m[2]) } : null; }).filter(Boolean);
    const row = { id: 1, accepting_orders: $("sOpen").checked, delivery_fee: n($("sFee").value), free_delivery_above: n($("sFree").value), min_order: n($("sMin").value), delivery_zones: zones, receipt_footer: $("sFoot").value.trim() || "Thank you for shopping with us!", updated_at: new Date().toISOString() };
    const { error } = await supabase.from("store_settings").upsert(row);
    if (error) return alert(error.message.includes("store_settings") ? "Run supabase/settings_v4.sql in Supabase first." : error.message);
    cfg = row; alert("Settings saved.");
  };
}

const main = document.querySelector(".admin-main");
main.insertAdjacentHTML("beforeend",
  docSec("rcv", "Receiving (Stock In)", "Supplier", "Supplier name", "Unit cost") +
  docSec("dsp", "Dispatching (Stock Out / Sales Receipt)", "Customer / Destination", "Walk-in or customer name", "Unit price") +
  `<section class="admin-view" id="cntView" hidden><div class="panel"><div class="panel-head"><h2>Ending Inventory (Stock Count)</h2><div class="row-actions"><input type="date" id="cntDate" class="small-input"><button class="btn btn-secondary" id="cntReset">Start new count</button></div></div><p class="muted">Scan each item (every scan = +1) or type the counted quantity. Blank items are treated as not counted.</p>${SCAN("cntScan")}<div class="rep-scroll"><table class="rep-table"><thead><tr><th>SKU</th><th>Item</th><th class="r">System</th><th class="r">Counted</th><th class="r">Variance</th><th class="r">Value</th></tr></thead><tbody id="cntLines"></tbody></table></div><div class="panel-head"><b id="cntTotal"></b><div class="row-actions"><button class="btn btn-secondary" id="cntPrint">Print count report</button><button class="btn btn-primary" id="cntApply">Apply to stock</button></div></div></div></section>` +
  `<section class="admin-view" id="settingsView" hidden><div class="panel"><div class="panel-head"><h2>Store Settings</h2></div><form id="setForm" class="form-grid" style="max-width:640px"><label class="check"><input id="sOpen" type="checkbox"> Accepting online orders</label><label>Delivery fee (flat, ₱)<input id="sFee" type="number" min="0" step="0.01"></label><label>Free delivery when order is ₱ or more (0 = off)<input id="sFree" type="number" min="0" step="0.01"></label><label>Minimum order amount (₱, 0 = none)<input id="sMin" type="number" min="0" step="0.01"></label><label>Delivery areas with own price (one per line: Area = price). If filled, customer picks an area and its price is used instead of the flat fee.<textarea id="sZones" placeholder="Liloan = 30&#10;Consolacion = 50&#10;Mandaue = 80"></textarea></label><label>Receipt footer message<input id="sFoot"></label><button class="btn btn-primary">Save Settings</button></form></div></section>`);

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession(); if (!session) return;
  doc("rcv", true); doc("dsp", false); cnt(); settings();
});
