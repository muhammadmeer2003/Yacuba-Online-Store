-- YACUBA V3: Inventory + stock history + auto stock-out for completed online orders.
-- Run in Supabase SQL Editor AFTER upgrade_v2.sql. Safe to run again.
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  category text,
  unit text not null default 'pcs',
  product_id uuid references public.products(id) on delete set null,
  sell_price numeric(12,2) not null default 0,
  reorder_level numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('purchase','sale','adjustment')),
  movement_date date not null default current_date,
  quantity numeric(12,2) not null check (quantity <> 0),
  unit_price numeric(12,2) not null default 0,
  supplier text,
  notes text,
  reference text,
  order_id uuid references public.orders(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_item_idx on public.stock_movements(item_id, movement_date);
alter table public.inventory_items enable row level security;
alter table public.stock_movements enable row level security;
drop policy if exists "inv items admin all" on public.inventory_items;
create policy "inv items admin all" on public.inventory_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "stock moves admin all" on public.stock_movements;
create policy "stock moves admin all" on public.stock_movements for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- When an online order becomes Completed, record a sale for each linked item (and undo if status changes back).
create or replace function public.sync_order_stock() returns trigger language plpgsql security definer set search_path=public as $$
declare it jsonb; inv uuid;
begin
  if new.status is distinct from old.status then
    delete from stock_movements where order_id = new.id;
    if new.status = 'Completed' then
      for it in select * from jsonb_array_elements(new.items) loop
        select id into inv from inventory_items where product_id = (it->>'product_id')::uuid limit 1;
        if inv is not null then
          insert into stock_movements(item_id,movement_type,movement_date,quantity,unit_price,reference,order_id,notes)
          values(inv,'sale',current_date,(it->>'quantity')::numeric,(it->>'unit_price')::numeric,new.order_number,new.id,'Online order');
        end if;
      end loop;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists orders_sync_stock on public.orders;
create trigger orders_sync_stock after update on public.orders for each row execute procedure public.sync_order_stock();
