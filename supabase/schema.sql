create extension if not exists pgcrypto;

create table if not exists public.watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text not null,
  model text not null,
  category text not null check (category in ('Dress', 'Diver', 'Field', 'Chronograph', 'GMT', 'Daily')),
  status text not null check (status in ('owned', 'wishlist')),
  movement text not null default 'Automatic' check (movement in ('Quartz', 'Automatic')),
  case_size_mm numeric(4, 1),
  price numeric(12, 2) not null default 0,
  source_url text not null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.watches
add column if not exists movement text not null default 'Automatic';

alter table public.watches
add column if not exists case_size_mm numeric(4, 1);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'watches_movement_check'
      and conrelid = 'public.watches'::regclass
  ) then
    alter table public.watches
    add constraint watches_movement_check check (movement in ('Quartz', 'Automatic'));
  end if;
end $$;

create index if not exists watches_user_created_idx on public.watches (user_id, created_at desc);
create index if not exists watches_user_status_idx on public.watches (user_id, status);
create index if not exists watches_user_category_idx on public.watches (user_id, category);

alter table public.watches enable row level security;

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

create table if not exists public.watch_share_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.watch_share_links enable row level security;

drop policy if exists "Users can read their share link" on public.watch_share_links;
drop policy if exists "Users can create their share link" on public.watch_share_links;
drop policy if exists "Users can update their share link" on public.watch_share_links;
drop policy if exists "Users can delete their share link" on public.watch_share_links;

create policy "Users can read their share link"
on public.watch_share_links for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their share link"
on public.watch_share_links for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their share link"
on public.watch_share_links for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their share link"
on public.watch_share_links for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.watch_share_links to authenticated;

create or replace function public.get_shared_wishlist(share_token uuid)
returns table (
  id uuid,
  brand text,
  model text,
  category text,
  status text,
  movement text,
  case_size_mm numeric,
  price numeric,
  source_url text,
  image_url text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    watches.id,
    watches.brand,
    watches.model,
    watches.category,
    watches.status,
    watches.movement,
    watches.case_size_mm,
    watches.price,
    watches.source_url,
    watches.image_url,
    watches.created_at,
    watches.updated_at
  from public.watch_share_links
  join public.watches on watches.user_id = watch_share_links.user_id
  where watch_share_links.token = share_token
    and watches.status = 'wishlist'
  order by watches.created_at desc;
$$;

revoke all on function public.get_shared_wishlist(uuid) from public;
grant execute on function public.get_shared_wishlist(uuid) to anon, authenticated;
