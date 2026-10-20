-- ULTIM'Peps — gestion du cashback manuel (migration additive)
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Les ajustements sont des écritures de journal : on ne remplace pas le solde calculé
-- à partir des parrainages et des utilisations existants.

create table if not exists public.store_cashback_adjustments (
  id bigint generated always as identity primary key,
  customer_email text not null,
  amount numeric(12,2) not null check (amount <> 0),
  reason text not null check (length(trim(reason)) between 2 and 300),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Si la table existait déjà avant cette migration, CREATE TABLE IF NOT EXISTS
-- ne lui ajoute pas les colonnes manquantes : on complète donc le schéma ici.
alter table public.store_cashback_adjustments
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists store_cashback_adjustments_customer_email_idx
  on public.store_cashback_adjustments (lower(customer_email));

alter table public.store_cashback_adjustments enable row level security;

drop policy if exists "Customers read own cashback adjustments" on public.store_cashback_adjustments;
create policy "Customers read own cashback adjustments"
on public.store_cashback_adjustments
for select to authenticated
using (lower(customer_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));

drop policy if exists "Admin manages cashback adjustments" on public.store_cashback_adjustments;
create policy "Admin manages cashback adjustments"
on public.store_cashback_adjustments
for all to authenticated
using ((select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com')
with check (
  (select auth.jwt() ->> 'email') = 'logan.decupper1@gmail.com'
  and lower(customer_email) <> ''
  and amount <> 0
  and length(trim(reason)) between 2 and 300
);

grant select, insert, update, delete on public.store_cashback_adjustments to authenticated;
grant usage, select on sequence public.store_cashback_adjustments_id_seq to authenticated;

-- Actualise le cache de schéma de l'API Supabase après les changements.
notify pgrst, 'reload schema';

-- L'accès réel reste filtré par RLS : un client ne peut lire que son e-mail
-- et seul l'administrateur autorisé peut créer/modifier/supprimer des ajustements.
