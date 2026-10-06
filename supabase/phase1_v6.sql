-- YACUBA V6 (phase 1): expiry dates, expenses, auto out-of-stock, stock check at checkout.
-- Run AFTER unit_v5.sql. Safe to run again.
alter table public.stock_movements add column if not exists expiry_date date;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null default 'Other',
  description text,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
drop policy if exists "expenses admin all" on public.expenses;
create policy "expenses admin all" on public.expenses for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.item_stock(iid uuid) returns numeric language sql stable security definer set search_path=public as $$
  select coalesce(sum(case movement_type when 'sale' then -quantity else quantity end), 0) from stock_movements where item_id = iid;
$$;

-- Product becomes unavailable when linked stock hits 0, and available again after restocking.
create or replace function public.sync_availability() returns trigger language plpgsql security definer set search_path=public as $$
declare r public.stock_movements; pid uuid; st numeric; delta numeric;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  select product_id into pid from inventory_items where id = r.item_id;
  if pid is null then return null; end if;
  st := item_stock(r.item_id);
  delta := case r.movement_type when 'sale' then -r.quantity else r.quantity end;
  if tg_op = 'DELETE' then delta := -delta; end if;
  if st <= 0 then update products set is_available = false where id = pid;
  elsif st - delta <= 0 then update products set is_available = true where id = pid; end if;
  return null;
end $$;
drop trigger if exists stock_availability on public.stock_movements;
create trigger stock_availability after insert or delete on public.stock_movements for each row execute procedure public.sync_availability();

-- Checkout: server calculates product prices AND delivery fee from store_settings.
create or replace function public.place_order(order_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  item jsonb; p record; inv uuid; st public.store_settings;
  normalized jsonb := '[]'::jsonb; qty numeric(10,2);
  subtotal numeric(12,2) := 0; fee numeric(12,2) := 0; area text;
  new_id uuid := gen_random_uuid();
  new_number text := 'YCS-' || upper(substr(replace(new_id::text,'-',''),1,8));
  customer text := trim(coalesce(order_payload->>'customer_name',''));
  ph text := trim(coalesce(order_payload->>'phone',''));
  addr text := trim(coalesce(order_payload->>'address',''));
  pay text := coalesce(nullif(trim(order_payload->>'payment_method'),''),'Cash on Delivery');
begin
  select * into st from store_settings where id = 1;
  if coalesce(st.accepting_orders, true) = false then raise exception 'The store is not accepting orders right now'; end if;
  if customer='' or ph='' or addr='' then raise exception 'Name, phone and address are required'; end if;
  if char_length(customer)>80 or char_length(ph)>40 or char_length(addr)>500 or char_length(coalesce(order_payload->>'notes',''))>500 then
    raise exception 'One of the fields is too long'; end if;
  if pay not in ('Cash on Delivery','Cash on Pickup') then pay := 'Cash on Delivery'; end if;
  if jsonb_typeof(order_payload->'items') is distinct from 'array' or jsonb_array_length(order_payload->'items')=0 then raise exception 'Your bag is empty'; end if;
  if jsonb_array_length(order_payload->'items')>50 then raise exception 'Too many items in one order'; end if;

  for item in select * from jsonb_array_elements(order_payload->'items') loop
    begin
      select id,name,price,sale_price,is_available,image_url,unit,qty_step into p from products where id=(item->>'product_id')::uuid;
      qty := coalesce((item->>'quantity')::numeric,1);
    exception when others then raise exception 'Invalid item in the bag'; end;
    if not found then raise exception 'A product in the bag no longer exists'; end if;
    if not p.is_available then raise exception 'Product % is currently unavailable', p.name; end if;
    select id into inv from inventory_items where product_id = p.id limit 1;
    if inv is not null and exists (select 1 from stock_movements where item_id = inv) and item_stock(inv) < 0.01 then
      raise exception '% is out of stock', p.name; end if;
    if coalesce(p.unit,'pcs')='kg' then qty := round(least(99, greatest(coalesce(p.qty_step,0.5), qty)),2); else qty := least(99, greatest(1, round(qty))); end if;
    if inv is not null and exists (select 1 from stock_movements where item_id = inv) and item_stock(inv) < qty then
      raise exception 'Only % left in stock for %', item_stock(inv), p.name; end if;
    subtotal := subtotal + round(coalesce(p.sale_price,p.price) * qty, 2);
    normalized := normalized || jsonb_build_array(jsonb_build_object('product_id',p.id,'name',p.name,'quantity',qty,'unit',coalesce(p.unit,'pcs'),'unit_price',coalesce(p.sale_price,p.price),'image_url',p.image_url));
  end loop;

  if coalesce(st.min_order,0) > 0 and subtotal < st.min_order then raise exception 'Minimum order is %', st.min_order; end if;

  if pay <> 'Cash on Pickup' then
    fee := coalesce(st.delivery_fee,0);
    area := nullif(trim(order_payload->>'delivery_area'),'');
    if area is not null and jsonb_array_length(coalesce(st.delivery_zones,'[]'::jsonb)) > 0 then
      select (z->>'fee')::numeric into fee from jsonb_array_elements(st.delivery_zones) z where lower(z->>'name')=lower(area) limit 1;
      if not found then fee := coalesce(st.delivery_fee,0); end if;
    end if;
    if coalesce(st.free_delivery_above,0) > 0 and subtotal >= st.free_delivery_above then fee := 0; end if;
  else area := null; end if;

  insert into orders(id,order_number,customer_name,phone,whatsapp,address,notes,payment_method,items,subtotal,delivery_fee,delivery_area,total_amount)
  values(new_id,new_number,customer,ph,nullif(trim(order_payload->>'whatsapp'),''),addr,nullif(trim(order_payload->>'notes'),''),pay,normalized,subtotal,fee,area,subtotal+fee);
  return jsonb_build_object('id',new_id,'order_number',new_number,'total',subtotal+fee,'delivery_fee',fee);
end $$;
grant execute on function public.place_order(jsonb) to anon, authenticated;
