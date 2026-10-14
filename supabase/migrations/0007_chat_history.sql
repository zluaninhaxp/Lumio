begin;
create table public.chat_messages (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  sequence bigint generated always as identity,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and length(payload::text) <= 100000),
  created_at timestamptz not null default now(),
  primary key (owner_id, id),
  check (payload ?& array['id','type','text','timestamp']),
  check (payload->>'id' = id),
  check (payload->>'type' in ('user','bot','fallback')),
  check (jsonb_typeof(payload->'text') = 'string'),
  check (jsonb_typeof(payload->'timestamp') = 'string'),
  check (payload - array['id','type','text','timestamp','cards','actions','quickActions']::text[] = '{}'::jsonb)
);
create index chat_messages_owner_sequence_idx on public.chat_messages(owner_id, sequence);
alter table public.chat_messages enable row level security;
create policy chat_messages_select_own on public.chat_messages for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.chat_messages from public, anon, authenticated;
grant select on public.chat_messages to authenticated;

-- A reply and the records it describes are committed in one transaction.
-- Stable message and domain ids make a retry safe after a lost HTTP response.
create function public.commit_lumio_state(expected_revision bigint, snapshot jsonb, chat_messages jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); entry jsonb; new_revision bigint;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if jsonb_typeof(chat_messages) <> 'array' or jsonb_array_length(chat_messages) > 100 or length(chat_messages::text) > 1000000 then
    raise exception 'Invalid messages' using errcode = '22023';
  end if;
  new_revision := public.replace_business_state(expected_revision, snapshot);
  for entry in select value from jsonb_array_elements(chat_messages) loop
    if jsonb_typeof(entry) <> 'object' or jsonb_typeof(entry->'id') <> 'string' then
      raise exception 'Invalid message' using errcode = '22023';
    end if;
    insert into public.chat_messages(owner_id,id,payload) values (uid,entry->>'id',entry)
      on conflict (owner_id,id) do nothing;
    if not exists (select 1 from public.chat_messages m where m.owner_id = uid and m.id = entry->>'id' and m.payload = entry) then
      raise exception 'Message id already used' using errcode = '22023';
    end if;
  end loop;
  return new_revision;
end $$;
revoke all on function public.commit_lumio_state(bigint,jsonb,jsonb) from public, anon;
grant execute on function public.commit_lumio_state(bigint,jsonb,jsonb) to authenticated;
commit;
