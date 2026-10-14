-- Catalog metadata only. No user rows, tokens, secrets or mutations.
begin read only;
select jsonb_build_object(
  'tables', (select jsonb_agg(to_jsonb(t)) from (
    select c.relname, c.relrowsecurity, c.relforcerowsecurity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by c.relname) t),
  'policies', (select jsonb_agg(to_jsonb(t)) from (
    select tablename,policyname,cmd,roles,qual,with_check from pg_policies
    where schemaname in ('public','storage') order by tablename,policyname) t),
  'grants', (select jsonb_agg(to_jsonb(t)) from (
    select table_name,grantee,privilege_type from information_schema.role_table_grants
    where table_schema='public' and grantee in ('anon','authenticated','service_role') order by table_name,grantee,privilege_type) t),
  'rpcs', (select jsonb_agg(to_jsonb(t)) from (
    select p.oid::regprocedure::text as signature,p.prosecdef as security_definer,p.proconfig,
      md5(pg_get_functiondef(p.oid)) as definition_hash, pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('replace_business_state','commit_lumio_state','get_business_state','consume_private_rate_limit')) t),
  'buckets', (select jsonb_agg(to_jsonb(t)) from (
    select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='profile-photos') t)
) as metadata;
commit;
