-- YACUBA V5: products sold by weight (kg). Run AFTER settings_v4.sql. Safe to run again.
alter table public.products add column if not exists unit text not null default 'pcs';
alter table public.products add column if not exists qty_step numeric(6,2) not null default 1;

-- Checkout: server calculates product prices AND delivery fee from store_settings.
create or replace function public.place_order(order_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  item jsonb; p record; st public.store_settings;
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
    if coalesce(p.unit,'pcs')='kg' then qty := round(least(99, greatest(coalesce(p.qty_step,0.5), qty)),2); else qty := least(99, greatest(1, round(qty))); end if;
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
