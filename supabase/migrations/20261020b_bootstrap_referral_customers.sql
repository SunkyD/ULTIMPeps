-- ULTIM'Peps : créer les profils au moment de l'inscription Supabase,
-- y compris lorsque la confirmation e-mail empêche d'obtenir une session immédiate.
create or replace function public.bootstrap_store_customer()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_name text := left(coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', ''), 160);
  v_rc text := upper(coalesce(nullif(new.raw_user_meta_data->>'rc',''), 'UP' || substr(md5(new.id::text || random()::text),1,8)));
  v_ref_code text := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code','')));
  v_referrer_id uuid;
  v_referrer_email text;
begin
  if v_email = '' then return new; end if;

  insert into public.customer_profiles as cp(user_id,email,data,updated_at)
  values(new.id,v_email,jsonb_build_object('n',v_name,'rc',v_rc,'t',extract(epoch from now())*1000),now())
  on conflict(user_id) do update
    set email=excluded.email,
        data=coalesce(cp.data,'{}'::jsonb) ||
             jsonb_build_object(
               'n',coalesce(nullif(cp.data->>'n',''),v_name),
               'rc',coalesce(nullif(cp.data->>'rc',''),v_rc)
             ),
        updated_at=now();

  -- Enregistre le parrainage dès l'inscription, même si l'e-mail doit encore être confirmé.
  if v_ref_code ~ '^[A-Z0-9]{4,12}$' then
    select user_id,lower(email) into v_referrer_id,v_referrer_email
      from public.customer_profiles
     where upper(coalesce(data->>'rc',''))=v_ref_code
     limit 1;
    if v_referrer_id is not null and v_referrer_id<>new.id and v_referrer_email is not null then
      insert into public.store_referrals(referrer_user_id,referred_user_id,referrer_email,referred_email,referral_code,referred_name)
      values(v_referrer_id,new.id,v_referrer_email,v_email,v_ref_code,v_name)
      on conflict(referred_user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bootstrap_store_customer_after_signup on auth.users;
create trigger bootstrap_store_customer_after_signup
after insert on auth.users
for each row execute function public.bootstrap_store_customer();

-- Rattrape les comptes Supabase déjà créés avant l'installation de ce correctif.
insert into public.customer_profiles as cp(user_id,email,data,updated_at)
select u.id,lower(u.email),
       jsonb_build_object(
         'n',left(coalesce(u.raw_user_meta_data->>'name',u.raw_user_meta_data->>'full_name',''),160),
         'rc',upper(coalesce(nullif(u.raw_user_meta_data->>'rc',''),'UP'||substr(md5(u.id::text || random()::text),1,8))),
         't',extract(epoch from coalesce(u.created_at,now()))*1000
       ),
       coalesce(u.created_at,now())
from auth.users u
where coalesce(u.email,'') <> ''
on conflict(user_id) do update
set email=excluded.email,
    data=coalesce(cp.data,'{}'::jsonb) ||
         jsonb_build_object(
           'n',coalesce(nullif(cp.data->>'n',''),excluded.data->>'n'),
           'rc',coalesce(nullif(cp.data->>'rc',''),excluded.data->>'rc')
         ),
    updated_at=coalesce(cp.updated_at,excluded.updated_at);

-- Les associations déjà reçues dans les métadonnées sont aussi récupérées.
insert into public.store_referrals(referrer_user_id,referred_user_id,referrer_email,referred_email,referral_code,referred_name)
select ref.user_id, referred.id, lower(ref.email), lower(referred.email),
       upper(trim(referred.raw_user_meta_data->>'referral_code')),
       left(coalesce(referred.raw_user_meta_data->>'name',referred.raw_user_meta_data->>'full_name',''),160)
from auth.users referred
join public.customer_profiles ref
  on upper(coalesce(ref.data->>'rc',''))=upper(trim(coalesce(referred.raw_user_meta_data->>'referral_code','')))
where coalesce(referred.raw_user_meta_data->>'referral_code','') ~* '^[A-Z0-9]{4,12}$'
  and ref.user_id<>referred.id
  and coalesce(referred.email,'')<>''
on conflict(referred_user_id) do nothing;
