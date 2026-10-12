-- ULTIM'Peps — étape 3 : profils clients synchronisés avec Supabase Auth
-- Migration additive : aucune donnée existante n'est supprimée.
-- Les mots de passe locaux (up_u) ne sont PAS copiés : chaque client devra créer/réinitialiser
-- son accès Supabase Auth, car les vérificateurs locaux ne sont pas compatibles avec Auth.

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;

drop policy if exists "Customers read own profile" on public.customer_profiles;
create policy "Customers read own profile"
on public.customer_profiles for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Customers insert own profile" on public.customer_profiles;
create policy "Customers insert own profile"
on public.customer_profiles for insert to authenticated
with check (
  user_id = (select auth.uid())
  and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

drop policy if exists "Customers update own profile" on public.customer_profiles;
create policy "Customers update own profile"
on public.customer_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

drop policy if exists "Admin manages customer profiles" on public.customer_profiles;
create policy "Admin manages customer profiles"
on public.customer_profiles for all to authenticated
using ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com');

-- Un client connecté peut consulter uniquement ses commandes, sans pouvoir les modifier.
drop policy if exists "Customers read own orders" on public.store_orders;
create policy "Customers read own orders"
on public.store_orders for select to authenticated
using (
  lower(customer_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

grant select, insert, update on public.customer_profiles to authenticated;
grant select on public.store_orders to authenticated;
