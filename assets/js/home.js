import { supabase } from "./supabase.js";
import { addToCart } from "./cart.js";
import { esc, money, renderStoreChrome } from "./site.js";

const $ = id => document.getElementById(id);
function productCard(p){ const price=Number(p.sale_price??p.price??0); return `<article class="product-card mini"><div class="product-media">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:`<div class="media-fallback">Y</div>`}</div><div class="product-content"><span class="eyebrow-sm">${esc(p.category_name||"Product")}</span><h3>${esc(p.name)}</h3><div class="price-line"><strong>${money(price)}</strong><button class="bag-btn" data-home-add="${p.id}">Add to Bag</button></div></div></article>`; }
async function load(){
  const [cats, prods, banners, reviews] = await Promise.all([
    supabase.from("categories").select("id,name").order("name").limit(12),
    supabase.from("products").select("id,name,description,price,sale_price,is_available,image_url,category_id").eq("is_available",true).order("created_at",{ascending:false}).limit(8),
    supabase.from("site_banners").select("id,title,subtitle,badge,button_text,button_link,image_url").eq("is_active",true).order("sort_order").limit(3),
    supabase.from("reviews").select("customer_name,rating,review_text").eq("status","approved").order("created_at",{ascending:false}).limit(6)
  ]);
  [cats,prods,banners,reviews].forEach(x=>{if(x.error) throw x.error;});
  const cmap=new Map((cats.data||[]).map(x=>[x.id,x.name]));
  $("homeCategories").innerHTML=(cats.data||[]).map(c=>`<a class="category-tile" href="products.html?category=${c.id}"><span>${esc(c.name)}</span><b>Shop →</b></a>`).join("") || `<p class="muted">Categories are being prepared.</p>`;
  const ps=(prods.data||[]).map(x=>({...x,category_name:cmap.get(x.category_id)||"Product"}));
  $("featuredProducts").innerHTML=ps.map(productCard).join("") || `<div class="empty-state"><h3>Products coming soon</h3><p>Our team is adding fresh products.</p></div>`;
  document.querySelectorAll("[data-home-add]").forEach(b=>b.onclick=()=>{const p=ps.find(x=>x.id===b.dataset.homeAdd); if(p){addToCart({...p,category_name:p.category_name});b.textContent="Added ✓";setTimeout(()=>b.textContent="Add to Bag",900);}});
  const bs=banners.data||[];
  if(bs[0]){const b=bs[0]; $("heroBadge").textContent=b.badge||"Fresh today"; $("heroTitle").textContent=b.title||"Good food. Good value. Good choice."; $("heroSubtitle").textContent=b.subtitle||"Browse frozen, grocery and baked favourites from YACUBA ONLINE STORE."; const btn=$("heroButton"); btn.textContent=b.button_text||"Shop Products"; btn.href=b.button_link||"products.html"; if(b.image_url) $("heroVisual").style.backgroundImage=`url("${b.image_url}")`;}
  $("reviewGrid").innerHTML=(reviews.data||[]).map(r=>`<article class="review-card"><div class="stars">${"★".repeat(Number(r.rating||0))}${"☆".repeat(5-Number(r.rating||0))}</div><p>“${esc(r.review_text)}”</p><strong>${esc(r.customer_name)}</strong></article>`).join("") || `<div class="empty-state"><h3>Be our first reviewer</h3><p>We would love to hear from you.</p></div>`;
  renderStoreChrome();
}

document.addEventListener("DOMContentLoaded",()=>load().catch(e=>{console.error(e); document.querySelectorAll(".dynamic-error").forEach(el=>el.textContent=e.message);}));
