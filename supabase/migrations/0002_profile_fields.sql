alter table public.profiles add column if not exists role text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
