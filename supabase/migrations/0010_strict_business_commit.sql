begin;
-- Incremental hardening. No existing records or legacy dates are rewritten.
create or replace function public._apply_business_state(expected_revision bigint, snapshot jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); current_revision bigint; relation_name text; item jsonb; line_item jsonb; item_count integer; item_position integer; prefs jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if snapshot is null or jsonb_typeof(snapshot) <> 'object' or length(snapshot::text) > 2000000 then
    raise exception 'Invalid snapshot' using errcode = '22023';
  end if;
  insert into public.business_state_revisions(owner_id) values (uid) on conflict do nothing;
  select revision into current_revision from public.business_state_revisions where owner_id = uid for update;
  if current_revision <> expected_revision then raise sqlstate 'PT409' using message = 'Revision conflict'; end if;
  set constraints all deferred;
  foreach relation_name in array array['clients','suppliers','employees','stock_items','catalog_items','orders','quotes','contracts','tasks','calendar_events','transactions','stock_movements','deliveries','appointments','commissions','generic_plugin_items'] loop
    if jsonb_typeof(snapshot->relation_name) <> 'array' then raise exception 'Invalid collection' using errcode = '22023'; end if;
    item_count := jsonb_array_length(snapshot->relation_name);
    if item_count > 5000 then raise exception 'Collection too large' using errcode = '22023'; end if;
    item_position := 0;
    for item in select value from jsonb_array_elements(snapshot->relation_name) loop
      if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'id') <> 'string' or length(item->>'id') not between 1 and 100 then
        raise exception 'Invalid item' using errcode = '22023';
      end if;
      if relation_name in ('orders','quotes') then
        if jsonb_typeof(item->'items') <> 'array' or jsonb_array_length(item->'items') > 200 then
          raise exception 'Invalid order items' using errcode = '22023';
        end if;
        for line_item in select value from jsonb_array_elements(item->'items') loop
          if jsonb_typeof(line_item) <> 'object' or jsonb_typeof(line_item->'quantity') <> 'number' or
             jsonb_typeof(line_item->'unitPrice') <> 'number' or (line_item->>'quantity')::numeric <= 0 or
             (line_item->>'unitPrice')::numeric < 0 then
            raise exception 'Invalid order line' using errcode = '22023';
          end if;
          if line_item ? 'stockItemId' and not exists (
            select 1 from jsonb_array_elements(snapshot->'stock_items') as ref(value) where ref.value->>'id' = line_item->>'stockItemId'
          ) then raise exception 'Invalid stock reference' using errcode = '23503'; end if;
          if line_item ? 'catalogItemId' and not exists (
            select 1 from jsonb_array_elements(snapshot->'catalog_items') as ref(value) where ref.value->>'id' = line_item->>'catalogItemId'
          ) then raise exception 'Invalid catalog reference' using errcode = '23503'; end if;
        end loop;
      end if;
      if relation_name = 'generic_plugin_items' then
        if jsonb_typeof(item->'pluginId') <> 'string' then raise exception 'Invalid plugin' using errcode = '22023'; end if;
        insert into public.generic_plugin_items(owner_id,id,plugin_id,data,position)
          values (uid,item->>'id',item->>'pluginId',item,item_position)
          on conflict (owner_id,plugin_id,id) do update set data = excluded.data, position = excluded.position, updated_at = now();
      else
        execute format('insert into public.%I(owner_id,id,data,position) values ($1,$2,$3,$4) on conflict (owner_id,id) do update set data = excluded.data, position = excluded.position, updated_at = now()', relation_name)
          using uid,item->>'id',item,item_position;
      end if;
      item_position := item_position + 1;
    end loop;
    if relation_name = 'generic_plugin_items' then
      delete from public.generic_plugin_items old_item where old_item.owner_id = uid and not exists (
        select 1 from jsonb_array_elements(snapshot->'generic_plugin_items') as entry(value)
        where entry.value->>'id' = old_item.id and entry.value->>'pluginId' = old_item.plugin_id
      );
    else
      execute format('delete from public.%I old_item where old_item.owner_id = $1 and not exists (select 1 from jsonb_array_elements($2) as entry(value) where entry.value->>''id'' = old_item.id)', relation_name)
        using uid,snapshot->relation_name;
    end if;
  end loop;
  prefs := snapshot->'preferences';
  if jsonb_typeof(prefs) <> 'object' then raise exception 'Invalid preferences' using errcode = '22023'; end if;
  insert into public.business_preferences(owner_id,data) values (uid,prefs)
    on conflict (owner_id) do update set data = excluded.data, updated_at = now();
  update public.business_state_revisions set revision = revision + 1, updated_at = now() where owner_id = uid returning revision into current_revision;
  return current_revision;
end $$;


create or replace function public.replace_business_state(expected_revision bigint, snapshot jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare relation_name text; entry jsonb; line jsonb; ids integer; total integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if expected_revision is null or expected_revision < 0 or jsonb_typeof(snapshot) is distinct from 'object'
    or length(snapshot::text) > 2000000 or jsonb_typeof(snapshot->'preferences') is distinct from 'object' then
    raise exception 'Invalid revision or snapshot' using errcode='22023';
  end if;
  if snapshot - array['clients','suppliers','employees','stock_items','catalog_items','orders','quotes','contracts','tasks','calendar_events','transactions','stock_movements','deliveries','appointments','commissions','generic_plugin_items','preferences']::text[] <> '{}'::jsonb then raise exception 'Unknown snapshot fields' using errcode='22023'; end if;
  foreach relation_name in array array['clients','suppliers','employees','stock_items','catalog_items','orders','quotes','contracts','tasks','calendar_events','transactions','stock_movements','deliveries','appointments','commissions','generic_plugin_items'] loop
    if jsonb_typeof(snapshot->relation_name) is distinct from 'array' or jsonb_array_length(snapshot->relation_name)>5000 then
      raise exception 'Missing or invalid collection' using errcode='22023';
    end if;
    select count(*),count(distinct (value->>'id',coalesce(value->>'pluginId',''))) into total,ids from jsonb_array_elements(snapshot->relation_name);
    if total <> ids then raise exception 'Duplicate record' using errcode='22023'; end if;
    for entry in select value from jsonb_array_elements(snapshot->relation_name) loop
      if jsonb_typeof(entry) is distinct from 'object' or jsonb_typeof(entry->'id') is distinct from 'string' or length(entry->>'id') not between 1 and 100 then raise exception 'Invalid record' using errcode='22023'; end if;
      if relation_name in ('orders','quotes') then
        if jsonb_typeof(entry->'items') is distinct from 'array' or jsonb_array_length(entry->'items') > 200 then raise exception 'Invalid lines' using errcode='22023'; end if;
        for line in select value from jsonb_array_elements(entry->'items') loop
          if jsonb_typeof(line) is distinct from 'object' or jsonb_typeof(line->'quantity') is distinct from 'number' or jsonb_typeof(line->'unitPrice') is distinct from 'number' then raise exception 'Invalid line values' using errcode='22023'; end if;
        end loop;
      end if;
    end loop;
  end loop;
  return public._apply_business_state(expected_revision,snapshot);
end $$;
revoke all on function public._apply_business_state(bigint,jsonb) from public,anon,authenticated;
revoke all on function public.replace_business_state(bigint,jsonb) from public,anon;
grant execute on function public.replace_business_state(bigint,jsonb) to authenticated;
create or replace function public.commit_lumio_state(expected_revision bigint, snapshot jsonb, chat_messages jsonb, onboarding_record jsonb, request_id text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); receipt public.business_commit_receipts; payload_hash text; new_revision bigint;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if expected_revision is null or expected_revision < 0 or request_id is null or length(request_id) not between 1 and 100
    or jsonb_typeof(chat_messages) is distinct from 'array' or jsonb_array_length(chat_messages)>100
    or length(chat_messages::text)>1000000 then raise exception 'Invalid commit' using errcode='22023'; end if;
  if onboarding_record is not null and (jsonb_typeof(onboarding_record) is distinct from 'object' or jsonb_typeof(onboarding_record->'responses') is distinct from 'object') then raise exception 'Invalid onboarding' using errcode='22023'; end if;
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

create or replace function public.commit_lumio_state(expected_revision bigint, snapshot jsonb, chat_messages jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); entry jsonb; new_revision bigint;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if jsonb_typeof(chat_messages) is distinct from 'array' or jsonb_array_length(chat_messages) > 100 or length(chat_messages::text) > 1000000 then
    raise exception 'Invalid messages' using errcode = '22023';
  end if;
  new_revision := public.replace_business_state(expected_revision, snapshot);
  for entry in select value from jsonb_array_elements(chat_messages) loop
    if jsonb_typeof(entry) is distinct from 'object' or jsonb_typeof(entry->'id') is distinct from 'string' then
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

-- Supabase default grants may include TRUNCATE/TRIGGER/REFERENCES. RLS does
-- not protect TRUNCATE. Domain clients need SELECT only, writes use the RPC.
do $$
declare relation_name text;
begin
  foreach relation_name in array array['business_state_revisions','clients','suppliers','employees','stock_items','catalog_items','orders','quotes','contracts','tasks','calendar_events','transactions','stock_movements','deliveries','appointments','commissions','generic_plugin_items','business_preferences','chat_messages','business_commit_receipts'] loop
    execute format('revoke all on table public.%I from public,anon,authenticated',relation_name);
    execute format('grant select on table public.%I to authenticated',relation_name);
  end loop;
end $$;
commit;
