begin;
-- Seed only missing preference keys. Existing canonical values always win.
insert into public.business_preferences(owner_id,data)
select user_id, jsonb_build_object('activatedPlugins', activated_plugins,
  'pluginOrder', case when jsonb_typeof(responses->'__lumioPluginOrder') = 'array' then responses->'__lumioPluginOrder' else '[]'::jsonb end)
from public.onboarding_records
on conflict (owner_id) do update set data = excluded.data || public.business_preferences.data;

-- Existing learned markers are retained as a legacy import. New changes share the canonical revision transaction.
insert into public.business_preferences(owner_id,data)
select user_id, jsonb_build_object('learnedIntentMarkers', jsonb_agg(jsonb_build_object(
  'phrase',phrase,'domain',domain,'resolution',resolution,'occurrences',occurrences,'lastSeenAt',last_seen_at) order by last_seen_at))
from public.learned_intent_markers group by user_id
on conflict (owner_id) do update set data = excluded.data || public.business_preferences.data;

create function public.commit_lumio_state(expected_revision bigint, snapshot jsonb, chat_messages jsonb, onboarding_record jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); new_revision bigint;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  new_revision := public.commit_lumio_state(expected_revision,snapshot,chat_messages);
  if onboarding_record is not null then
    if jsonb_typeof(onboarding_record) <> 'object' or jsonb_typeof(onboarding_record->'responses') <> 'object'
      or length(onboarding_record::text) > 1000000 then raise exception 'Invalid onboarding' using errcode = '22023'; end if;
    insert into public.onboarding_records(user_id,responses,context,structured_profile,activated_plugins,updated_at)
    values (uid,onboarding_record->'responses',onboarding_record->'context',onboarding_record->'structuredProfile',
      array(select jsonb_array_elements_text(snapshot->'preferences'->'activatedPlugins')),now())
    on conflict (user_id) do update set responses = excluded.responses, context = excluded.context,
      structured_profile = excluded.structured_profile, updated_at = now();
    update public.profiles set onboarding_completed = true, updated_at = now() where id = uid;
    if not found then raise exception 'Profile missing' using errcode = '23503'; end if;
  end if;
  return new_revision;
end $$;
revoke all on function public.commit_lumio_state(bigint,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.commit_lumio_state(bigint,jsonb,jsonb,jsonb) to authenticated;
comment on column public.onboarding_records.activated_plugins is 'Legacy baseline only. business_preferences.data is the canonical module configuration.';
commit;
