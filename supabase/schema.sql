create extension if not exists pgcrypto;

create table if not exists public.watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text not null,
  model text not null,
  category text not null check (category in ('Dress', 'Diver', 'Field', 'Chronograph', 'GMT', 'Daily')),
  status text not null check (status in ('owned', 'wishlist')),
  price numeric(12, 2) not null default 0,
  source_url text not null,
  image_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watch_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  budget numeric(12, 2) not null default 6000,
  updated_at timestamptz not null default now()
);

create index if not exists watches_user_created_idx on public.watches (user_id, created_at desc);
create index if not exists watches_user_status_idx on public.watches (user_id, status);
create index if not exists watches_user_category_idx on public.watches (user_id, category);

alter table public.watches enable row level security;
alter table public.watch_settings enable row level security;

drop policy if exists "Users can read their watches" on public.watches;
drop policy if exists "Users can add their watches" on public.watches;
drop policy if exists "Users can update their watches" on public.watches;
drop policy if exists "Users can delete their watches" on public.watches;

create policy "Users can read their watches"
on public.watches for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add their watches"
on public.watches for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their watches"
on public.watches for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their watches"
on public.watches for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their settings" on public.watch_settings;
drop policy if exists "Users can add their settings" on public.watch_settings;
drop policy if exists "Users can update their settings" on public.watch_settings;

create policy "Users can read their settings"
on public.watch_settings for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add their settings"
on public.watch_settings for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their settings"
on public.watch_settings for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
