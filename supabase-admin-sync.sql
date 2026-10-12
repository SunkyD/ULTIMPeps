-- ULTIM'Peps — migration de synchronisation admin
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Ne jamais ajouter une clé service_role au site.

create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.store_settings enable row level security;
drop policy if exists "Public reads storefront settings" on public.store_settings;
create policy "Public reads storefront settings"
on public.store_settings for select to anon, authenticated
using (key in ('storefront_content','storefront_shipping','storefront_payment','storefront_prelaunch'));
drop policy if exists "Admin manages storefront settings" on public.store_settings;
create policy "Admin manages storefront settings"
on public.store_settings for all to authenticated
using ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com');

create table if not exists public.promo_codes (
  code text primary key,
  data jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
drop policy if exists "Public reads general active promo codes" on public.promo_codes;
create policy "Public reads general active promo codes"
on public.promo_codes for select to anon, authenticated
using (
  active = true
  and coalesce(data->>'for','') = ''
  and coalesce(data->>'rw','0') not in ('1','true')
);
drop policy if exists "Admin manages promo codes" on public.promo_codes;
create policy "Admin manages promo codes"
on public.promo_codes for all to authenticated
using ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com');

create table if not exists public.store_packs (
  id bigint primary key,
  data jsonb not null,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.store_packs enable row level security;
drop policy if exists "Public reads published packs" on public.store_packs;
create policy "Public reads published packs"
on public.store_packs for select to anon, authenticated using (published = true);
drop policy if exists "Admin manages packs" on public.store_packs;
create policy "Admin manages packs"
on public.store_packs for all to authenticated
using ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com');

-- Commandes : privées par défaut. La synchronisation client/admin sera reliée
-- avec des fonctions RPC sécurisées dans une étape dédiée.
create table if not exists public.store_orders (
  id text primary key,
  customer_email text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.store_orders enable row level security;
drop policy if exists "Admin manages all orders" on public.store_orders;
create policy "Admin manages all orders"
on public.store_orders for all to authenticated
using ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com');

-- Newsletter : jamais de lecture publique des adresses.
create table if not exists public.store_newsletter (
  email text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.store_newsletter enable row level security;
drop policy if exists "Admin manages newsletter" on public.store_newsletter;
create policy "Admin manages newsletter"
on public.store_newsletter for all to authenticated
using ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com');

-- Comptes clients locaux actuels (up_u) ne sont volontairement PAS copiés :
-- ils contiennent des vérificateurs de mots de passe et doivent migrer vers Supabase Auth.
