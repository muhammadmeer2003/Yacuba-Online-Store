-- YACUBA ONLINE STORE V2.1 FIXES
-- Run this in Supabase SQL Editor AFTER upgrade_v2.sql. Safe to run more than once.

-- 1) SECURITY: customers must NOT insert orders directly (they could set any total).
--    Orders are created only through place_order(), which is SECURITY DEFINER.
drop policy if exists "orders public insert" on public.orders;

-- 2) Spam / abuse limits on public forms
alter table public.reviews drop constraint if exists reviews_len_chk;
alter table public.reviews add constraint reviews_len_chk check (char_length(customer_name) <= 80 and char_length(review_text) <= 1000);
alter table public.feedback drop constraint if exists feedback_len_chk;
alter table public.feedback add constraint feedback_len_chk check (char_length(name) <= 80 and char_length(message) <= 2000 and char_length(coalesce(email,'')) <= 120 and char_length(coalesce(phone,'')) <= 40);

-- 3) Hardened checkout: empty cart check, quantity cap, bad ids, field limits, valid payment method
create or replace function public.place_order(order_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  item jsonb;
  p record;
  normalized jsonb := '[]'::jsonb;
  qty integer;
  subtotal numeric(12,2) := 0;
  new_id uuid := gen_random_uuid();
  new_number text := 'YCS-' || upper(substr(replace(new_id::text,'-',''),1,8));
  customer text := trim(coalesce(order_payload->>'customer_name',''));
  ph text := trim(coalesce(order_payload->>'phone',''));
  addr text := trim(coalesce(order_payload->>'address',''));
  pay text := coalesce(nullif(trim(order_payload->>'payment_method'),''),'Cash on Delivery');
begin
  if customer='' or ph='' or addr='' then raise exception 'Name, phone and address are required'; end if;
  if char_length(customer)>80 or char_length(ph)>40 or char_length(addr)>500 or char_length(coalesce(order_payload->>'notes',''))>500 then
    raise exception 'One of the fields is too long';
  end if;
  if pay not in ('Cash on Delivery','Cash on Pickup') then pay := 'Cash on Delivery'; end if;
  if jsonb_typeof(order_payload->'items') is distinct from 'array' or jsonb_array_length(order_payload->'items')=0 then
    raise exception 'Your bag is empty';
  end if;
  if jsonb_array_length(order_payload->'items')>50 then raise exception 'Too many items in one order'; end if;

  for item in select * from jsonb_array_elements(order_payload->'items') loop
    begin
      qty := least(99, greatest(1, coalesce((item->>'quantity')::integer,1)));
      select id,name,price,sale_price,is_available,image_url into p from products where id=(item->>'product_id')::uuid;
    exception when others then
      raise exception 'Invalid item in the bag';
    end;
    if not found then raise exception 'A product in the bag no longer exists'; end if;
    if not p.is_available then raise exception 'Product % is currently unavailable', p.name; end if;
    subtotal := subtotal + (coalesce(p.sale_price,p.price) * qty);
    normalized := normalized || jsonb_build_array(jsonb_build_object('product_id',p.id,'name',p.name,'quantity',qty,'unit_price',coalesce(p.sale_price,p.price),'image_url',p.image_url));
  end loop;

  insert into orders(id,order_number,customer_name,phone,whatsapp,address,notes,payment_method,items,subtotal,total_amount)
  values(new_id,new_number,customer,ph,nullif(trim(order_payload->>'whatsapp'),''),addr,nullif(trim(order_payload->>'notes'),''),pay,normalized,subtotal,subtotal);

  return jsonb_build_object('id',new_id,'order_number',new_number,'total',subtotal);
end;
$$;
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- 4) Safe order status lookup for the success page (returns ONLY status, never customer data)
create or replace function public.track_order(order_no text)
returns jsonb
language sql
security definer
set search_path=public
stable
as $$
  select jsonb_build_object('status', status) from orders where order_number = upper(trim(order_no)) limit 1;
$$;
grant execute on function public.track_order(text) to anon, authenticated;
