create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'customer' check (role in ('admin','customer')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,email) values(new.id,new.email) on conflict(id) do nothing; return new; end;$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists categories_name_lower_unique on public.categories(lower(name));

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  price numeric(12,2) not null default 0 check(price>=0),
  sale_price numeric(12,2) null check(sale_price is null or sale_price>=0),
  description text,
  is_available boolean not null default true,
  image_url text,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_created_at_idx on public.products(created_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end;$$;
drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at before update on public.products for each row execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select to authenticated using(auth.uid()=id or public.is_admin());

drop policy if exists "categories public read" on public.categories;
create policy "categories public read" on public.categories for select to anon,authenticated using(true);
drop policy if exists "categories admin insert" on public.categories;
create policy "categories admin insert" on public.categories for insert to authenticated with check(public.is_admin());
drop policy if exists "categories admin update" on public.categories;
create policy "categories admin update" on public.categories for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "categories admin delete" on public.categories;
create policy "categories admin delete" on public.categories for delete to authenticated using(public.is_admin());

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products for select to anon,authenticated using(true);
drop policy if exists "products admin insert" on public.products;
create policy "products admin insert" on public.products for insert to authenticated with check(public.is_admin());
drop policy if exists "products admin update" on public.products;
create policy "products admin update" on public.products for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "products admin delete" on public.products;
create policy "products admin delete" on public.products for delete to authenticated using(public.is_admin());

insert into storage.buckets(id,name,public) values('product-images','product-images',true) on conflict(id) do update set public=true;

drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects for select to public using(bucket_id='product-images');
drop policy if exists "product images admin upload" on storage.objects;
create policy "product images admin upload" on storage.objects for insert to authenticated with check(bucket_id='product-images' and public.is_admin());
drop policy if exists "product images admin update" on storage.objects;
create policy "product images admin update" on storage.objects for update to authenticated using(bucket_id='product-images' and public.is_admin()) with check(bucket_id='product-images' and public.is_admin());
drop policy if exists "product images admin delete" on storage.objects;
create policy "product images admin delete" on storage.objects for delete to authenticated using(bucket_id='product-images' and public.is_admin());

insert into public.categories(name) values('Frozen Items'),('Grocery Items'),('Baked Items'),('Drinks'),('Snacks'),('Dairy Products') on conflict do nothing;
