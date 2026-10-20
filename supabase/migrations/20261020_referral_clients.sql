-- ULTIM'Peps: source serveur pour les parrainages et la liste clients.
-- À exécuter une seule fois dans Supabase > SQL Editor avant d'activer les nouvelles fonctions JS.
create table if not exists public.store_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referrer_email text not null,
  referred_email text not null,
  referral_code text not null,
  referred_name text,
  created_at timestamptz not null default now(),
  constraint store_referrals_no_self check (referrer_user_id <> referred_user_id)
);
create index if not exists store_referrals_referrer_idx on public.store_referrals(referrer_user_id);
create index if not exists store_referrals_referred_email_idx on public.store_referrals(lower(referred_email));
alter table public.store_referrals enable row level security;
revoke all on public.store_referrals from anon, authenticated;

create or replace function public.register_store_referral(p_code text, p_name text default null)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_referrer_id uuid;
  v_referrer_email text;
  v_code text := upper(trim(coalesce(p_code,'')));
begin
  if v_uid is null or v_email = '' or v_code !~ '^[A-Z0-9]{4,12}$' then return false; end if;
  if exists(select 1 from public.store_referrals where referred_user_id=v_uid) then return true; end if;
  select cp.user_id, lower(cp.email)
    into v_referrer_id, v_referrer_email
    from public.customer_profiles cp
   where upper(coalesce(cp.data->>'rc',''))=v_code
   limit 1;
  if v_referrer_id is null or v_referrer_id=v_uid or v_referrer_email is null then return false; end if;
  insert into public.store_referrals(referrer_user_id,referred_user_id,referrer_email,referred_email,referral_code,referred_name)
  values(v_referrer_id,v_uid,v_referrer_email,v_email,v_code,left(coalesce(p_name,''),160))
  on conflict(referred_user_id) do nothing;
  return true;
end;
$$;

create or replace function public.admin_store_customers()
returns table(user_id uuid,email text,data jsonb,updated_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt()->>'email','')) <> 'logan.decupper1@gmail.com' then
    raise exception 'Accès administrateur requis' using errcode='42501';
  end if;
  return query select cp.user_id,cp.email,cp.data,cp.updated_at
    from public.customer_profiles cp order by cp.updated_at desc nulls last;
end;
$$;

create or replace function public.admin_store_referrals()
returns table(referrer_email text,referred_email text,referral_code text,referred_name text,created_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(coalesce(auth.jwt()->>'email','')) <> 'logan.decupper1@gmail.com' then
    raise exception 'Accès administrateur requis' using errcode='42501';
  end if;
  return query select r.referrer_email,r.referred_email,r.referral_code,r.referred_name,r.created_at
    from public.store_referrals r order by r.created_at desc;
end;
$$;

create or replace function public.my_store_referrals()
returns table(referrer_email text,referred_email text,referral_code text,referred_name text,created_at timestamptz)
language sql
security definer
set search_path = public, auth
as $$
  select r.referrer_email,r.referred_email,r.referral_code,r.referred_name,r.created_at
  from public.store_referrals r
  where r.referrer_user_id=auth.uid()
  order by r.created_at desc;
$$;

revoke all on function public.register_store_referral(text,text) from public, anon;
revoke all on function public.admin_store_customers() from public, anon;
revoke all on function public.admin_store_referrals() from public, anon;
revoke all on function public.my_store_referrals() from public, anon;
grant execute on function public.register_store_referral(text,text) to authenticated;
grant execute on function public.admin_store_customers() to authenticated;
grant execute on function public.admin_store_referrals() to authenticated;
grant execute on function public.my_store_referrals() to authenticated;
