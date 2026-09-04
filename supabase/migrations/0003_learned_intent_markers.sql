create table if not exists public.learned_intent_markers (
  user_id uuid not null references auth.users(id) on delete cascade,
  phrase text not null,
  domain text not null check (domain in ('task', 'calendar', 'financial')),
  resolution text not null,
  occurrences integer not null default 1 check (occurrences > 0),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, domain, phrase)
);

alter table public.learned_intent_markers enable row level security;

drop policy if exists learned_intent_markers_select_own on public.learned_intent_markers;
create policy learned_intent_markers_select_own on public.learned_intent_markers for select using (auth.uid() = user_id);
drop policy if exists learned_intent_markers_insert_own on public.learned_intent_markers;
create policy learned_intent_markers_insert_own on public.learned_intent_markers for insert with check (auth.uid() = user_id);
drop policy if exists learned_intent_markers_update_own on public.learned_intent_markers;
create policy learned_intent_markers_update_own on public.learned_intent_markers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists learned_intent_markers_delete_own on public.learned_intent_markers;
create policy learned_intent_markers_delete_own on public.learned_intent_markers for delete using (auth.uid() = user_id);

update public.onboarding_records
set structured_profile = case
  when jsonb_typeof(structured_profile->'taxonomy') = 'object' then jsonb_set(
    structured_profile - 'learnedIntentMarkers',
    '{taxonomy}',
    (structured_profile->'taxonomy') - 'learnedIntentMarkers'
  )
  else structured_profile - 'learnedIntentMarkers'
end
where structured_profile is not null and jsonb_typeof(structured_profile) = 'object';
