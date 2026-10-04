-- YACUBA V4: barcode, store settings (delivery prices), delivery fee in orders.
-- Run in Supabase SQL Editor AFTER inventory_v3.sql. Safe to run again.
alter table public.inventory_items add column if not exists barcode text;
create unique index if not exists inventory_items_barcode_key on public.inventory_items(barcode) where barcode is not null;

create table if not exists public.store_settings (
  id int primary key default 1 check (id = 1),
  delivery_fee numeric(12,2) not null default 0,
  free_delivery_above numeric(12,2) not null default 0,
  min_order numeric(12,2) not null default 0,
  delivery_zones jsonb not null default '[]'::jsonb,
  accepting_orders boolean not null default true,
  receipt_footer text not null default 'Thank you for shopping with us!',
  updated_at timestamptz not null default now()
);
insert into public.store_settings(id) values (1) on conflict do nothing;
alter table public.store_settings enable row level security;
drop policy if exists "settings public read" on public.store_settings;
create policy "settings public read" on public.store_settings for select to anon, authenticated using (true);
drop policy if exists "settings admin insert" on public.store_settings;
create policy "settings admin insert" on public.store_settings for insert to authenticated with check (public.is_admin());
drop policy if exists "settings admin update" on public.store_settings;
create policy "settings admin update" on public.store_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.orders add column if not exists delivery_fee numeric(12,2) not null default 0;
alter table public.orders add column if not exists delivery_area text;

-- Checkout: server calculates product prices AND delivery fee from store_settings.
create or replace function public.place_order(order_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  item jsonb; p record; st public.store_settings;
  normalized jsonb := '[]'::jsonb; qty integer;
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
      qty := least(99, greatest(1, coalesce((item->>'quantity')::integer,1)));
      select id,name,price,sale_price,is_available,image_url into p from products where id=(item->>'product_id')::uuid;
    exception when others then raise exception 'Invalid item in the bag'; end;
    if not found then raise exception 'A product in the bag no longer exists'; end if;
    if not p.is_available then raise exception 'Product % is currently unavailable', p.name; end if;
    subtotal := subtotal + (coalesce(p.sale_price,p.price) * qty);
    normalized := normalized || jsonb_build_array(jsonb_build_object('product_id',p.id,'name',p.name,'quantity',qty,'unit_price',coalesce(p.sale_price,p.price),'image_url',p.image_url));
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
