-- ULTIM'Peps: corrections manuelles de cashback avec journal serveur.
create table if not exists public.store_cashback_adjustments (
  id bigint generated always as identity primary key,
  customer_email text not null,
  amount numeric(10,2) not null check (amount > 0),
  direction text not null check (direction in ('credit','debit')),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  admin_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists store_cashback_adjustments_customer_idx
  on public.store_cashback_adjustments (lower(customer_email), created_at desc);
alter table public.store_cashback_adjustments enable row level security;
revoke all on public.store_cashback_adjustments from anon, authenticated;
grant select, insert on public.store_cashback_adjustments to authenticated;

create or replace function public.admin_add_cashback_adjustment(
  p_email text, p_amount numeric, p_direction text, p_reason text
) returns jsonb
language plpgsql security definer set search_path=public,auth
as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_id bigint;
begin
  if lower(coalesce(auth.jwt()->>'email','')) <> 'logan.decupper1@gmail.com' then
    raise exception 'Accès administrateur refusé';
  end if;
  if v_email = '' or p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'E-mail ou montant invalide';
  end if;
  if p_direction not in ('credit','debit') then raise exception 'Sens invalide'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 3 or char_length(trim(p_reason)) > 500 then
    raise exception 'Le motif doit contenir entre 3 et 500 caractères';
  end if;
  if not exists(select 1 from public.customer_profiles where lower(email)=v_email) then
    raise exception 'Aucun compte client Supabase correspondant';
  end if;
  insert into public.store_cashback_adjustments(customer_email,amount,direction,reason,admin_user_id)
  values(v_email,round(p_amount,2),p_direction,trim(p_reason),auth.uid()) returning id into v_id;
  return jsonb_build_object('id',v_id,'email',v_email,'amount',round(p_amount,2),
    'direction',p_direction,'reason',trim(p_reason),'created_at',now());
end $$;

create or replace function public.admin_store_cashback_adjustments()
returns table(id bigint, customer_email text, amount numeric, direction text, reason text, created_at timestamptz)
language plpgsql security definer set search_path=public,auth
as $$
begin
  if lower(coalesce(auth.jwt()->>'email','')) <> 'logan.decupper1@gmail.com' then
    raise exception 'Accès administrateur refusé';
  end if;
  return query select a.id,a.customer_email,a.amount,a.direction,a.reason,a.created_at
    from public.store_cashback_adjustments a order by a.created_at desc;
end $$;

create or replace function public.my_store_cashback_adjustments()
returns table(id bigint, amount numeric, direction text, reason text, created_at timestamptz)
language plpgsql security definer set search_path=public,auth
as $$
declare v_email text := lower(coalesce(auth.jwt()->>'email',''));
begin
  if auth.uid() is null or v_email = '' then raise exception 'Connexion requise'; end if;
  return query select a.id,a.amount,a.direction,a.reason,a.created_at
    from public.store_cashback_adjustments a where lower(a.customer_email)=v_email
    order by a.created_at desc;
end $$;

revoke all on function public.admin_add_cashback_adjustment(text,numeric,text,text) from public,anon;
revoke all on function public.admin_store_cashback_adjustments() from public,anon;
revoke all on function public.my_store_cashback_adjustments() from public,anon;
grant execute on function public.admin_add_cashback_adjustment(text,numeric,text,text) to authenticated;
grant execute on function public.admin_store_cashback_adjustments() to authenticated;
grant execute on function public.my_store_cashback_adjustments() to authenticated;
