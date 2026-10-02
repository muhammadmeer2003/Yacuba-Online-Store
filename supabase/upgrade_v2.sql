-- YACUBA ONLINE STORE V2 UPGRADE
-- Run this AFTER your existing schema.sql.
-- It adds orders, reviews, feedback, homepage banners and the checkout RPC.

create extension if not exists pgcrypto;

alter table public.products add column if not exists featured boolean not null default false;
alter table public.products add column if not exists stock_label text;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_name text not null,
  phone text not null,
  whatsapp text,
  address text not null,
  notes text,
  payment_method text not null default 'Cash on Delivery',
  status text not null default 'Pending' check (status in ('Pending','Confirmed','Preparing','Out for Delivery','Completed','Cancelled')),
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  review_text text not null,
  status text not null default 'pending' check (status in ('pending','approved','hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new','read','resolved')),
  created_at timestamptz not null default now()
);

create table if not exists public.site_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  badge text,
  button_text text default 'Shop Products',
  button_link text default 'products.html',
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_orders_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders for each row execute procedure public.touch_orders_updated_at();

create or replace function public.touch_banner_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists banner_touch_updated_at on public.site_banners;
create trigger banner_touch_updated_at before update on public.site_banners for each row execute procedure public.touch_banner_updated_at();

alter table public.orders enable row level security;
alter table public.reviews enable row level security;
alter table public.feedback enable row level security;
alter table public.site_banners enable row level security;

-- Public reading
 drop policy if exists "orders admin read" on public.orders;
create policy "orders admin read" on public.orders for select to authenticated using (public.is_admin());
 drop policy if exists "orders public insert" on public.orders;
create policy "orders public insert" on public.orders for insert to anon,authenticated with check (true);
 drop policy if exists "orders admin update" on public.orders;
create policy "orders admin update" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

 drop policy if exists "reviews public read approved" on public.reviews;
create policy "reviews public read approved" on public.reviews for select to anon,authenticated using (status='approved' or public.is_admin());
 drop policy if exists "reviews public insert" on public.reviews;
create policy "reviews public insert" on public.reviews for insert to anon,authenticated with check (status='pending');
 drop policy if exists "reviews admin update" on public.reviews;
create policy "reviews admin update" on public.reviews for update to authenticated using (public.is_admin()) with check (public.is_admin());

 drop policy if exists "feedback admin read" on public.feedback;
create policy "feedback admin read" on public.feedback for select to authenticated using (public.is_admin());
 drop policy if exists "feedback public insert" on public.feedback;
create policy "feedback public insert" on public.feedback for insert to anon,authenticated with check (status='new');
 drop policy if exists "feedback admin update" on public.feedback;
create policy "feedback admin update" on public.feedback for update to authenticated using (public.is_admin()) with check (public.is_admin());

 drop policy if exists "banner public read" on public.site_banners;
create policy "banner public read" on public.site_banners for select to anon,authenticated using (is_active=true or public.is_admin());
 drop policy if exists "banner admin insert" on public.site_banners;
create policy "banner admin insert" on public.site_banners for insert to authenticated with check (public.is_admin());
 drop policy if exists "banner admin update" on public.site_banners;
create policy "banner admin update" on public.site_banners for update to authenticated using (public.is_admin()) with check (public.is_admin());
 drop policy if exists "banner admin delete" on public.site_banners;
create policy "banner admin delete" on public.site_banners for delete to authenticated using (public.is_admin());

-- Server-side checkout. Calculates prices from the real products table.
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
  customer text := trim(order_payload->>'customer_name');
  ph text := trim(order_payload->>'phone');
  addr text := trim(order_payload->>'address');
begin
  if customer='' or ph='' or addr='' then raise exception 'Name, phone and address are required'; end if;
  if jsonb_typeof(order_payload->'items') <> 'array' then raise exception 'Cart is empty'; end if;

  for item in select * from jsonb_array_elements(order_payload->'items') loop
    qty := greatest(1, coalesce((item->>'quantity')::integer,1));
    select id,name,price,sale_price,is_available,image_url into p from products where id=(item->>'product_id')::uuid;
    if not found then raise exception 'A product in the cart no longer exists'; end if;
    if not p.is_available then raise exception 'Product % is currently unavailable', p.name; end if;
    subtotal := subtotal + (coalesce(p.sale_price,p.price) * qty);
    normalized := normalized || jsonb_build_array(jsonb_build_object('product_id',p.id,'name',p.name,'quantity',qty,'unit_price',coalesce(p.sale_price,p.price),'image_url',p.image_url));
  end loop;

  insert into orders(id,order_number,customer_name,phone,whatsapp,address,notes,payment_method,items,subtotal,total_amount)
  values(new_id,new_number,customer,ph,nullif(trim(order_payload->>'whatsapp'),''),addr,nullif(trim(order_payload->>'notes'),''),coalesce(nullif(trim(order_payload->>'payment_method'),''),'Cash on Delivery'),normalized,subtotal,subtotal);

  return jsonb_build_object('id',new_id,'order_number',new_number,'total',subtotal);
end;
$$;

grant execute on function public.place_order(jsonb) to anon, authenticated;

insert into public.site_banners(title,subtitle,badge,button_text,button_link,is_active,sort_order)
select 'Good food. Good value. Good choice.','Frozen, grocery and baked favourites from YACUBA ONLINE STORE.','Fresh today','Shop Products','products.html',true,0
where not exists (select 1 from public.site_banners);
