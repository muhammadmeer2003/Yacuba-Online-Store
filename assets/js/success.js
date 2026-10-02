import { supabase } from "./supabase.js";
import { renderStoreChrome } from "./site.js";
document.addEventListener("DOMContentLoaded",async()=>{renderStoreChrome();const n=new URLSearchParams(location.search).get("order");document.getElementById("orderNumber").textContent=n||"Your order";if(n){const {data}=await supabase.from("orders").select("order_number,status,created_at").eq("order_number",n).maybeSingle();if(data)document.getElementById("orderStatus").textContent=`Status: ${data.status}`;}});
