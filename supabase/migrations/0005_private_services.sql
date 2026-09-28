create table public.ai_credentials (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  nonce bytea not null check (octet_length(nonce) = 12),
  ciphertext bytea not null check (octet_length(ciphertext) between 17 and 8192),
  key_version integer not null default 1 check (key_version > 0),
  updated_at timestamptz not null default now()
);
alter table public.ai_credentials enable row level security;
-- No client policies: only authenticated Edge Functions with server credentials
-- may read or mutate encrypted credentials.

create table public.private_rate_limits (
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (length(operation) between 1 and 50),
  window_started_at timestamptz not null,
  hits integer not null check (hits >= 0),
  primary key (owner_id, operation)
);
alter table public.private_rate_limits enable row level security;

create or replace function public.consume_private_rate_limit(
  subject uuid, operation_name text, max_hits integer, window_seconds integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare current_hits integer;
begin
  if subject is null or operation_name !~ '^[a-z_]{1,50}$' or max_hits not between 1 and 1000 or window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate limit' using errcode = '22023';
  end if;
  insert into public.private_rate_limits(owner_id, operation, window_started_at, hits)
    values (subject, operation_name, now(), 1)
  on conflict (owner_id, operation) do update set
    window_started_at = case when public.private_rate_limits.window_started_at + make_interval(secs => window_seconds) <= now()
      then now() else public.private_rate_limits.window_started_at end,
    hits = case when public.private_rate_limits.window_started_at + make_interval(secs => window_seconds) <= now()
      then 1 else public.private_rate_limits.hits + 1 end
  returning hits into current_hits;
  return current_hits <= max_hits;
end $$;
revoke all on function public.consume_private_rate_limit(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_private_rate_limit(uuid,text,integer,integer) to service_role;

create or replace function public.limit_business_writes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.consume_private_rate_limit(new.owner_id, 'business_write', 600, 3600) then
    raise sqlstate 'PT429' using message = 'Write limit reached';
  end if;
  return new;
end $$;
create trigger limit_business_writes before update on public.business_state_revisions
  for each row execute function public.limit_business_writes();

create or replace function public.limit_direct_user_writes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if auth.role() = 'authenticated' then
    owner := auth.uid();
    if owner is null or not public.consume_private_rate_limit(owner, 'write_' || tg_table_name, 300, 3600) then
      raise sqlstate 'PT429' using message = 'Write limit reached';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger limit_profile_writes before update on public.profiles
  for each row execute function public.limit_direct_user_writes();
create trigger limit_onboarding_writes before insert or update or delete on public.onboarding_records
  for each row execute function public.limit_direct_user_writes();
create trigger limit_learned_marker_writes before insert or update or delete on public.learned_intent_markers
  for each row execute function public.limit_direct_user_writes();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-photos','profile-photos',false,1048576,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Restrictive policies keep this bucket closed even if another broad storage
-- policy exists in the project. Service-role function calls bypass RLS.
create policy deny_direct_profile_photo_select on storage.objects as restrictive for select to public
  using (bucket_id <> 'profile-photos');
create policy deny_direct_profile_photo_insert on storage.objects as restrictive for insert to public
  with check (bucket_id <> 'profile-photos');
create policy deny_direct_profile_photo_update on storage.objects as restrictive for update to public
  using (bucket_id <> 'profile-photos') with check (bucket_id <> 'profile-photos');
create policy deny_direct_profile_photo_delete on storage.objects as restrictive for delete to public
  using (bucket_id <> 'profile-photos');

-- Profile text fields are bounded even if the caller skips client validation.
alter table public.profiles add constraint profiles_name_length check (length(name) <= 200) not valid;
alter table public.profiles add constraint profiles_phone_length check (length(phone) <= 40) not valid;
alter table public.profiles add constraint profiles_role_length check (length(role) <= 100) not valid;
alter table public.profiles add constraint profiles_photo_private_path
  check (photo is null or photo ~ ('^' || id::text || '/[0-9a-f-]{36}[.]webp$')) not valid;

create or replace function public.protect_profile_photo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.photo is distinct from old.photo and auth.role() <> 'service_role' then
    raise exception 'Photo changes require the upload service' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger protect_profile_photo before update on public.profiles
  for each row execute function public.protect_profile_photo();

alter table public.onboarding_records add constraint onboarding_payload_size
  check (length(responses::text) <= 200000 and
         (context is null or length(context::text) <= 200000) and
         (structured_profile is null or length(structured_profile::text) <= 400000) and
         cardinality(activated_plugins) <= 100) not valid;
alter table public.learned_intent_markers add constraint learned_intent_lengths
  check (length(phrase) between 1 and 250 and length(resolution) between 1 and 500) not valid;
