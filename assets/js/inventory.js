import { supabase } from "./supabase.js";
import { STORE } from "./config.js";
import { esc, money } from "./site.js";
const $ = id => document.getElementById(id);
const S = { items: [], moves: [], products: [], edit: null, rep: null };
const n = v => Number(v || 0), f2 = v => Number(n(v).toFixed(2)), today = () => new Date().toISOString().slice(0, 10);
const TYPE = { purchase: "Stock In", sale: "Sale", adjustment: "Adjustment" };

async function all(table, order) {
  let out = [], from = 0;
  for (;;) {
    const { data, error } = await supabase.from(table).select("*").order(order, { ascending: false }).order("id").range(from, from + 999);
    if (error) throw error; out = out.concat(data);
    if (data.length < 1000) break; from += 1000;
  }
  return out;
}
async function load() {
  try {
    const [i, m, p] = await Promise.all([all("inventory_items", "created_at"), all("stock_movements", "movement_date"), supabase.from("products").select("id,name").order("name")]);
    S.items = i; S.moves = m; S.products = p.data || [];
    render(); report();
  } catch (e) { console.error(e); $("invList").innerHTML = `<div class="empty-admin">Inventory not ready: run supabase/inventory_v3.sql in Supabase first.<br><small>${esc(e.message)}</small></div>`; }
}
// stock + cost per item, counting movements up to date `to`
function calc(to) {
  const r = {};
  S.items.forEach(i => r[i.id] = { i, pq: 0, pc: 0, sq: 0, sr: 0, aq: 0 });
  S.moves.forEach(m => {
    if (to && m.movement_date > to) return;
    const x = r[m.item_id]; if (!x) return;
    const q = n(m.quantity), a = q * n(m.unit_price);
    if (m.movement_type === "purchase") { x.pq += q; x.pc += a; } else if (m.movement_type === "sale") { x.sq += q; x.sr += a; } else x.aq += q;
  });
  Object.values(r).forEach(x => { x.stock = x.pq - x.sq + x.aq; x.avg = x.pq ? x.pc / x.pq : 0; x.value = Math.max(x.stock, 0) * x.avg; });
  return r;
}
function render() {
  const c = Object.values(calc()), s = $("invSearch").value.trim().toLowerCase();
  $("invCount").textContent = c.length;
  $("invLow").textContent = c.filter(x => x.stock <= n(x.i.reorder_level)).length;
  $("invUnits").textContent = f2(c.reduce((t, x) => t + x.stock, 0));
  $("invValue").textContent = money(c.reduce((t, x) => t + x.value, 0));
  $("invList").innerHTML = c.filter(x => !s || `${x.i.sku} ${x.i.name}`.toLowerCase().includes(s)).map(x => {
    const st = x.stock <= 0 ? "Out" : x.stock <= n(x.i.reorder_level) ? "Low" : "In stock";
    return `<div class="data-row"><div class="grow"><strong>${esc(x.i.sku)} · ${esc(x.i.name)}</strong><span>${f2(x.stock)} ${esc(x.i.unit)} · avg cost ${money(x.avg)} · sell ${money(x.i.sell_price)} · value ${money(x.value)}${x.i.category ? " · " + esc(x.i.category) : ""}</span></div><span class="status ${st === "In stock" ? "good" : "bad"}">${st}</span><div class="row-actions"><button class="small-btn" data-mv="purchase" data-id="${x.i.id}">+ Stock In</button><button class="small-btn" data-mv="sale" data-id="${x.i.id}">Sale</button><button class="small-btn" data-mv="adjustment" data-id="${x.i.id}">Adjust</button><button class="small-btn" data-edit="${x.i.id}">Edit</button><button class="small-btn danger" data-del="${x.i.id}">Delete</button></div></div>`;
  }).join("") || `<div class="empty-admin">No inventory items yet. Click "+ Add Item".</div>`;
  const im = new Map(S.items.map(i => [i.id, i]));
  $("moveList").innerHTML = S.moves.slice(0, 100).map(m => {
    const i = im.get(m.item_id) || {};
    return `<div class="data-row"><div class="grow"><strong>${m.movement_date} · ${TYPE[m.movement_type]} · ${esc(i.sku || "")} ${esc(i.name || "")}</strong><span>${f2(m.quantity)} × ${money(m.unit_price)} = ${money(n(m.quantity) * n(m.unit_price))}${m.supplier ? " · " + esc(m.supplier) : ""}${m.reference ? " · " + esc(m.reference) : ""}${m.notes ? " · " + esc(m.notes) : ""}</span></div>${m.order_id ? '<span class="status good">Online order</span>' : `<button class="small-btn danger" data-delmv="${m.id}">Delete</button>`}</div>`;
  }).join("") || `<div class="empty-admin">No stock movements yet.</div>`;
  document.querySelectorAll("[data-mv]").forEach(b => b.onclick = () => openMove(b.dataset.mv, b.dataset.id));
  document.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openItem(b.dataset.edit));
  document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => delItem(b.dataset.del));
  document.querySelectorAll("[data-delmv]").forEach(b => b.onclick = () => delMove(b.dataset.delmv));
}
function openItem(id) {
  const i = S.items.find(x => x.id === id); S.edit = i || null;
  $("iProduct").innerHTML = '<option value="">Not linked</option>' + S.products.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  $("iSku").value = i?.sku || `SKU-${String(S.items.length + 1).padStart(3, "0")}`; $("iName").value = i?.name || ""; $("iCategory").value = i?.category || "";
  $("iUnit").value = i?.unit || "pcs"; $("iProduct").value = i?.product_id || ""; $("iPrice").value = i?.sell_price ?? 0; $("iReorder").value = i?.reorder_level ?? 5; $("iNotes").value = i?.notes || "";
  $("itemModal").classList.add("open");
}
async function saveItem(e) {
  e.preventDefault();
  const p = { sku: $("iSku").value.trim().toUpperCase(), name: $("iName").value.trim(), category: $("iCategory").value.trim() || null, unit: $("iUnit").value.trim() || "pcs", product_id: $("iProduct").value || null, sell_price: n($("iPrice").value), reorder_level: n($("iReorder").value), notes: $("iNotes").value.trim() || null };
  const r = S.edit ? await supabase.from("inventory_items").update(p).eq("id", S.edit.id) : await supabase.from("inventory_items").insert(p);
  if (r.error) return alert(r.error.code === "23505" ? "This SKU already exists." : r.error.message);
  $("itemModal").classList.remove("open"); await load();
}
async function delItem(id) {
  const i = S.items.find(x => x.id === id);
  if (!confirm(`Delete ${i.sku} and ALL its stock history?`)) return;
  const { error } = await supabase.from("inventory_items").delete().eq("id", id); if (error) alert(error.message); else load();
}
function mUi() {
  const t = $("mType").value;
  $("mPriceLabel").firstChild.textContent = t === "sale" ? "Selling price per unit" : "Cost per unit";
  $("mQtyHint").textContent = t === "adjustment" ? "(use minus for loss, e.g. -2)" : "";
  $("mPrice").disabled = t === "adjustment";
}
function openMove(type, id) {
  $("mItem").innerHTML = S.items.map(i => `<option value="${i.id}">${esc(i.sku)} · ${esc(i.name)}</option>`).join("");
  $("mItem").value = id; $("mType").value = type; $("mDate").value = today(); $("mQty").value = ""; $("mSupplier").value = ""; $("mNote").value = "";
  const i = S.items.find(x => x.id === id); $("mPrice").value = type === "sale" ? i.sell_price : (calc()[id]?.avg ? f2(calc()[id].avg) : 0);
  $("mTitle").textContent = "Stock Movement"; mUi(); $("moveModal").classList.add("open");
}
async function saveMove(e) {
  e.preventDefault();
  const t = $("mType").value, q = n($("mQty").value), id = $("mItem").value;
  if (!q || (t !== "adjustment" && q < 0)) return alert("Enter a valid quantity.");
  if (t === "sale" && q > (calc()[id]?.stock || 0) && !confirm("Quantity is more than the stock on hand. Continue?")) return;
  const { error } = await supabase.from("stock_movements").insert({ item_id: id, movement_type: t, movement_date: $("mDate").value, quantity: q, unit_price: t === "adjustment" ? 0 : n($("mPrice").value), supplier: $("mSupplier").value.trim() || null, notes: $("mNote").value.trim() || null });
  if (error) return alert(error.message);
  $("moveModal").classList.remove("open"); await load();
}
async function delMove(id) { if (!confirm("Delete this entry?")) return; const { error } = await supabase.from("stock_movements").delete().eq("id", id); if (error) alert(error.message); else load(); }

// ---------- Report ----------
function preset() {
  const p = $("repPreset").value, d = new Date(), y = d.getFullYear(), m = d.getMonth();
  const iso = x => new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  if (p === "custom") return;
  $("repTo").value = iso(d);
  $("repFrom").value = p === "month" ? iso(new Date(y, m, 1)) : p === "30" ? iso(new Date(d.getTime() - 29 * 864e5)) : p === "year" ? iso(new Date(y, 0, 1)) : "";
}
const tbl = (h, rows, tot) => `<div class="rep-scroll"><table class="rep-table"><thead><tr>${h.map((x, k) => `<th class="${k > 1 ? "r" : ""}">${x}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((x, k) => `<td class="${k > 1 ? "r" : ""}">${x}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${h.length}">No data</td></tr>`}${tot ? `<tr class="tot">${tot.map((x, k) => `<td class="${k > 1 ? "r" : ""}">${x}</td>`).join("")}</tr>` : ""}</tbody></table></div>`;
async function report() {
  const from = $("repFrom").value, to = $("repTo").value, c = calc(to), im = new Map(S.items.map(i => [i.id, i]));
  const B = {}; Object.values(c).forEach(x => B[x.i.id] = { x, bq: 0, bc: 0, sq: 0, sr: 0, cogs: 0, loss: 0 });
  const inR = S.moves.filter(m => (!from || m.movement_date >= from) && (!to || m.movement_date <= to)).sort((a, b) => a.movement_date.localeCompare(b.movement_date));
  inR.forEach(m => { const b = B[m.item_id]; if (!b) return; const q = n(m.quantity), a = q * n(m.unit_price);
    if (m.movement_type === "purchase") { b.bq += q; b.bc += a; } else if (m.movement_type === "sale") { b.sq += q; b.sr += a; b.cogs += q * b.x.avg; } else if (q < 0) b.loss += -q * b.x.avg; });
  const L = Object.values(B), sum = k => L.reduce((t, b) => t + b[k], 0);
  const T = { buy: sum("bc"), rev: sum("sr"), cogs: sum("cogs"), loss: sum("loss"), stock: Object.values(c).reduce((t, x) => t + x.value, 0) };
  T.gross = T.rev - T.cogs; T.net = T.gross - T.loss;
  let oq = supabase.from("orders").select("total_amount").eq("status", "Completed"); if (from) oq = oq.gte("created_at", from); if (to) oq = oq.lte("created_at", to + "T23:59:59");
  const { data: od } = await oq; const ot = (od || []).reduce((t, o) => t + n(o.total_amount), 0);
  const cl = v => `<span class="${v >= 0 ? "pos" : "neg"}">${money(v)}</span>`;
  const sumRows = [["Total purchases (money spent on stock)", money(T.buy)], ["Total sales (inventory items)", money(T.rev)], ["Cost of goods sold (avg cost)", money(T.cogs)], ["Gross profit", cl(T.gross)], ["Stock losses / adjustments", money(T.loss)], ["<b>Net profit</b>", `<b>${cl(T.net)}</b>`], ["Closing stock value (at cost)", money(T.stock)], [`Completed online orders (${(od || []).length}, all products)`, money(ot)]];
  const itemRows = L.filter(b => b.bq || b.sq || b.x.stock).map(b => [esc(b.x.i.sku), esc(b.x.i.name), f2(b.bq), money(b.bc), f2(b.sq), money(b.sr), cl(b.sr - b.cogs), f2(b.x.stock), money(b.x.value)]);
  const mv = t => inR.filter(m => m.movement_type === t).map(m => [m.movement_date, esc(`${im.get(m.item_id)?.sku || ""} ${im.get(m.item_id)?.name || ""}`), f2(m.quantity), money(m.unit_price), money(n(m.quantity) * n(m.unit_price)), esc(m.supplier || m.reference || "")]);
  const buys = mv("purchase"), sales = mv("sale");
  const period = `${from || "Start"} to ${to || "Today"}`;
  $("repOut").innerHTML = `<p class="muted">Period: <b>${period}</b></p><h3>Summary</h3><div class="rep-scroll"><table class="rep-table"><tbody>${sumRows.map(r => `<tr><td>${r[0]}</td><td class="r">${r[1]}</td></tr>`).join("")}</tbody></table></div><h3>Per-item</h3>${tbl(["SKU", "Item", "Bought", "Cost", "Sold", "Sales", "Profit", "Stock", "Value"], itemRows)}<h3>Purchases (when bought)</h3>${tbl(["Date", "Item", "Qty", "Unit cost", "Total", "Supplier"], buys)}<h3>Sales</h3>${tbl(["Date", "Item", "Qty", "Unit price", "Total", "Customer / Ref"], sales)}`;
  S.rep = { period, sumRows, itemRows, buys, sales };
}
const strip = s => String(s).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#039;/g, "'");
function csv() {
  if (!S.rep) return; const r = S.rep, rows = [[STORE.MART_NAME + " - Financial Report"], ["Period", r.period], [], ["SUMMARY"], ...r.sumRows, [], ["PER ITEM"], ["SKU", "Item", "Bought qty", "Bought cost", "Sold qty", "Sales", "Profit", "Stock", "Stock value"], ...r.itemRows, [], ["PURCHASES"], ["Date", "Item", "Qty", "Unit cost", "Total", "Supplier"], ...r.buys, [], ["SALES"], ["Date", "Item", "Qty", "Unit price", "Total", "Customer/Ref"], ...r.sales];
  const text = rows.map(x => x.map(v => `"${strip(v).replace(/₱|,/g, "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv" })); a.download = `yacuba-report-${today()}.csv`; a.click();
}
async function print() {
  await report();
  $("printArea").innerHTML = `<div class="rep-head"><img src="../assets/img/logo-mark.png" alt=""><div><h2>${esc(STORE.MART_NAME)}</h2><p>${esc(STORE.MART_ADDRESS)} · ${esc(STORE.MART_PHONE)}</p><p><b>Financial & Inventory Report</b> · ${S.rep.period} · Generated ${new Date().toLocaleString()}</p></div></div>` + $("repOut").innerHTML;
  document.body.classList.add("print-report");
  addEventListener("afterprint", () => document.body.classList.remove("print-report"), { once: true });
  setTimeout(() => window.print(), 50);
}
document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession(); if (!session) return;
  $("newItemBtn").onclick = () => openItem(null); $("itemForm").onsubmit = saveItem; $("moveForm").onsubmit = saveMove;
  $("mType").onchange = mUi; $("invSearch").oninput = render;
  $("repPreset").onchange = () => { preset(); report(); }; $("repRun").onclick = report; $("repPrint").onclick = print; $("repCsv").onclick = csv;
  $("repFrom").onchange = $("repTo").onchange = () => { $("repPreset").value = "custom"; };
  preset(); await load();
});
