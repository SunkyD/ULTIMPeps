-- ULTIM'Peps — étape 2 : enregistrement sécurisé et synchronisation des commandes
-- Migration additive : ne supprime aucune commande existante.
alter table public.store_orders enable row level security;
drop policy if exists "Admin manages all orders" on public.store_orders;
create policy "Admin manages all orders"
on public.store_orders for all to authenticated
using ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com');

create or replace function public.submit_store_order(p_id text, p_customer_email text, p_data jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare normalized_email text;
begin
  normalized_email := lower(trim(coalesce(p_customer_email, '')));
  if p_id is null or p_id !~ '^UP-[0-9]{6}$' then
    raise exception 'Référence de commande invalide';
  end if;
  if length(normalized_email) > 254
     or normalized_email !~ '^[A-Za-z0-9.!#$%&''*+/=?^_{}|~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object'
     or length(p_data::text) > 65536
     or p_data->>'id' is distinct from p_id
     or lower(coalesce(p_data #>> '{cu,e}', '')) is distinct from normalized_email then
    raise exception 'Données de commande invalides';
  end if;
  insert into public.store_orders(id, customer_email, data)
  values (p_id, normalized_email, p_data)
  on conflict (id) do nothing;
  return found;
end;
$$;
revoke all on function public.submit_store_order(text,text,jsonb) from public;
grant execute on function public.submit_store_order(text,text,jsonb) to anon, authenticated;
