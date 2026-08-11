create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  photo text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Meu negócio',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table if not exists public.onboarding_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  responses jsonb not null default '{}'::jsonb,
  context jsonb,
  structured_profile jsonb,
  activated_plugins text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_business_id uuid;
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email)
  on conflict (id) do update set email = excluded.email;

  insert into public.businesses (name, created_by)
  values (coalesce(nullif(new.raw_user_meta_data ->> 'business_name', ''), 'Meu negócio'), new.id)
  returning id into new_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (new_business_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.onboarding_records enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists business_members_select_own on public.business_members;
create policy business_members_select_own on public.business_members for select using (auth.uid() = user_id);

drop policy if exists businesses_select_member on public.businesses;
create policy businesses_select_member on public.businesses for select using (
  exists (select 1 from public.business_members member where member.business_id = businesses.id and member.user_id = auth.uid())
);

drop policy if exists onboarding_select_own on public.onboarding_records;
create policy onboarding_select_own on public.onboarding_records for select using (auth.uid() = user_id);
drop policy if exists onboarding_insert_own on public.onboarding_records;
create policy onboarding_insert_own on public.onboarding_records for insert with check (auth.uid() = user_id);
drop policy if exists onboarding_update_own on public.onboarding_records;
create policy onboarding_update_own on public.onboarding_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
