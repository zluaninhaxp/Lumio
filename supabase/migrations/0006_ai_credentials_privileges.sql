-- Credentials are exclusively accessed by the authenticated Edge Function
-- using the server-side service role. RLS stays enabled with no client policies.
alter table public.ai_credentials enable row level security;
revoke all on table public.ai_credentials from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_credentials to service_role;
revoke all on table public.private_rate_limits from public, anon, authenticated;
