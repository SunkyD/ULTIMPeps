-- ULTIM'Peps — phase 1 : packs partagés et inscription newsletter sécurisée
-- À exécuter dans Supabase > SQL Editor. Migration additive : ne supprime aucune donnée.

create table if not exists public.store_packs (
  id bigint primary key,
  data jsonb not null,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.store_packs enable row level security;
drop policy if exists "Public reads published packs" on public.store_packs;
create policy "Public reads published packs" on public.store_packs
for select to anon, authenticated using (published = true);
drop policy if exists "Admin manages packs" on public.store_packs;
create policy "Admin manages packs" on public.store_packs for all to authenticated
using ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com');

create table if not exists public.store_newsletter (
  email text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.store_newsletter enable row level security;
drop policy if exists "Admin manages newsletter" on public.store_newsletter;
create policy "Admin manages newsletter" on public.store_newsletter for all to authenticated
using ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com');

create or replace function public.newsletter_signup(p_email text, p_source text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare normalized_email text;
begin
  normalized_email := lower(trim(coalesce(p_email, '')));
  if length(normalized_email) > 254
     or normalized_email !~ '^[A-Za-z0-9.!#$%&''*+/=?^_{}|~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  insert into public.store_newsletter(email, data)
  values (normalized_email, jsonb_build_object('s', nullif(left(coalesce(p_source, ''), 30), '')))
  on conflict (email) do nothing;
  return found;
end;
$$;
revoke all on function public.newsletter_signup(text,text) from public;
grant execute on function public.newsletter_signup(text,text) to anon, authenticated;
