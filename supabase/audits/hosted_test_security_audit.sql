-- Read-only hosted TEST audit.
-- Run only after confirming the SQL Editor project ref is bvtqtvqvwbqmuewuhipc.
-- This file contains metadata SELECTs only and must not be run against production.
--
-- The migration-history table is not guaranteed to be queryable from SQL Editor.
-- This audit checks whether it exists instead of referencing it directly.
-- For authoritative migration status, also run:
-- npx supabase migration list --project-ref bvtqtvqvwbqmuewuhipc

select current_database() as database_name,
       inet_server_addr() as server_address,
       inet_server_port() as server_port,
       current_user as executing_role;

-- Safe migration-history availability check.
select expected.schema_name,
       expected.table_name,
       c.relkind as object_type,
       coalesce(has_schema_privilege(current_user, n.oid, 'USAGE'), false) as schema_usage,
       coalesce(has_table_privilege(current_user, c.oid, 'SELECT'), false) as can_select
from (values ('supabase_migrations', 'schema_migrations')) as expected(schema_name, table_name)
left join pg_namespace n on n.nspname = expected.schema_name
left join pg_class c on c.relnamespace = n.oid and c.relname = expected.table_name;

select table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where (table_schema = 'public' and table_name in (
  'profiles', 'user_roles', 'organizers', 'regions', 'events',
  'event_date_locks', 'payments', 'refunds', 'event_documents',
  'event_status_history', 'audit_logs'
))
   or (table_schema = 'storage' and table_name = 'objects')
order by table_schema, table_name, ordinal_position;

select table_schema, table_name, grantee, privilege_type, is_grantable
from information_schema.table_privileges
where table_schema in ('public', 'storage')
  and table_name in (
    'profiles', 'user_roles', 'organizers', 'events', 'event_date_locks',
    'payments', 'refunds', 'event_documents', 'audit_logs', 'objects'
  )
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by table_schema, table_name, grantee, privilege_type;

select table_schema, table_name, column_name, grantee, privilege_type, is_grantable
from information_schema.column_privileges
where table_schema in ('public', 'storage')
  and table_name in ('profiles', 'user_roles', 'organizers', 'events', 'event_documents', 'objects')
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by table_schema, table_name, column_name, grantee, privilege_type;

select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'public' and c.relname in (
  'profiles', 'user_roles', 'organizers', 'events', 'event_date_locks',
  'payments', 'refunds', 'event_documents', 'audit_logs'
))
   or (n.nspname = 'storage' and c.relname = 'objects')
order by schema_name, table_name;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in (
  'profiles', 'user_roles', 'organizers', 'events', 'event_date_locks',
  'payments', 'refunds', 'event_documents', 'audit_logs'
))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select p.oid::regprocedure as signature,
       n.nspname as schema_name,
       r.rolname as owner,
       p.prosecdef as security_definer,
       p.provolatile as volatility,
       p.proconfig as settings,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public'
  and p.proname in (
    'set_organizer_verification', 'set_event_document_review', 'submit_proposal', 'release_expired_holds',
    'get_region_availability', 'has_role', 'is_staff', 'is_super_admin'
  )
order by signature;

select p.oid::regprocedure as signature,
       grantee.rolname as grantee,
       acl.privilege_type,
       acl.is_grantable
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl on true
left join pg_roles grantee on grantee.oid = acl.grantee
where n.nspname = 'public'
  and p.proname in (
    'set_organizer_verification', 'set_event_document_review', 'submit_proposal', 'release_expired_holds',
    'get_region_availability', 'has_role', 'is_staff', 'is_super_admin'
  )
order by signature, grantee.rolname, acl.privilege_type;

-- Constraints, guarded so missing tables do not abort the audit.
select format('%I.%I', ns.nspname, tbl.relname) as table_name,
       c.conname, c.contype, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class tbl on tbl.oid = c.conrelid
join pg_namespace ns on ns.oid = tbl.relnamespace
where ns.nspname = 'public'
  and tbl.relname in ('events', 'event_date_locks', 'organizers')
order by table_name, c.conname;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('organizer-documents', 'payment-proofs')
order by id;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where (schemaname = 'public' and tablename in ('events', 'event_date_locks', 'organizers', 'event_documents'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, indexname;
