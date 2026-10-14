begin;
create table public.business_commit_receipts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  payload_hash text not null,
  revision bigint check (revision > 0),
  created_at timestamptz not null default now(),
  primary key(owner_id,id)
);
alter table public.business_commit_receipts enable row level security;
create policy commit_receipts_select_own on public.business_commit_receipts for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.business_commit_receipts from public,anon,authenticated;
grant select on public.business_commit_receipts to authenticated;

create function public.commit_lumio_state(expected_revision bigint, snapshot jsonb, chat_messages jsonb, onboarding_record jsonb, request_id text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); receipt public.business_commit_receipts; payload_hash text; new_revision bigint;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  -- Hash is an idempotency check, not an authentication mechanism; no second copy of business/chat content is stored.
  payload_hash := md5(expected_revision::text || snapshot::text || chat_messages::text || coalesce(onboarding_record::text,'null'));
  insert into public.business_commit_receipts(owner_id,id,payload_hash) values (uid,request_id,payload_hash)
    on conflict (owner_id,id) do nothing;
  select * into receipt from public.business_commit_receipts where owner_id=uid and id=request_id for update;
  if receipt.payload_hash <> payload_hash then raise exception 'Request id already used' using errcode = '22023'; end if;
  if receipt.revision is not null then return receipt.revision; end if;
  new_revision := public.commit_lumio_state(expected_revision,snapshot,chat_messages,onboarding_record);
  update public.business_commit_receipts set revision=new_revision where owner_id=uid and id=request_id;
  return new_revision;
end $$;
revoke all on function public.commit_lumio_state(bigint,jsonb,jsonb,jsonb,text) from public,anon;
grant execute on function public.commit_lumio_state(bigint,jsonb,jsonb,jsonb,text) to authenticated;
commit;
