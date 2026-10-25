begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(not has_table_privilege('anon', 'public.organizers', 'INSERT'), 'anon cannot insert organizers');
select ok(not has_table_privilege('anon', 'public.organizers', 'UPDATE'), 'anon cannot update organizers');
select ok(not has_table_privilege('anon', 'public.organizers', 'DELETE'), 'anon cannot delete organizers');
select ok(not has_table_privilege('authenticated', 'public.organizers', 'INSERT'), 'organizer insert is column-scoped');
select ok(not has_table_privilege('authenticated', 'public.organizers', 'UPDATE'), 'organizer update is column-scoped');
select ok(not has_table_privilege('authenticated', 'public.organizers', 'DELETE'), 'organizers cannot be deleted by app roles');
select ok(not has_table_privilege('authenticated', 'public.organizers', 'TRUNCATE'), 'organizers cannot be truncated by app roles');
select ok(not has_table_privilege('authenticated', 'public.organizers', 'MAINTAIN'), 'organizers cannot be maintained by app roles');
select ok(has_table_privilege('authenticated', 'public.organizers', 'SELECT'), 'organizer reads remain available');
select ok(has_column_privilege('authenticated', 'public.organizers', 'owner_id', 'INSERT'), 'organizers may set owner_id subject to RLS');
select ok(not has_column_privilege('authenticated', 'public.organizers', 'owner_id', 'UPDATE'), 'organizer ownership cannot be reassigned');
select ok(has_column_privilege('authenticated', 'public.organizers', 'contact_person', 'UPDATE'), 'organizer contact details remain editable');
select ok(not has_column_privilege('authenticated', 'public.organizers', 'verification_status', 'UPDATE'), 'organizer verification is staff-managed');
select ok(not has_column_privilege('authenticated', 'public.organizers', 'created_at', 'UPDATE'), 'organizer timestamps are protected');

select ok(not has_table_privilege('anon', 'public.events', 'INSERT'), 'anon cannot insert events');
select ok(not has_table_privilege('anon', 'public.events', 'UPDATE'), 'anon cannot update events');
select ok(not has_table_privilege('anon', 'public.events', 'DELETE'), 'anon cannot delete events');
select ok(not has_table_privilege('authenticated', 'public.events', 'INSERT'), 'event insert is column-scoped');
select ok(not has_table_privilege('authenticated', 'public.events', 'UPDATE'), 'event update is column-scoped');
select ok(not has_table_privilege('authenticated', 'public.events', 'DELETE'), 'events cannot be deleted by app roles');
select ok(not has_table_privilege('authenticated', 'public.events', 'TRUNCATE'), 'events cannot be truncated by app roles');
select ok(not has_table_privilege('authenticated', 'public.events', 'MAINTAIN'), 'events cannot be maintained by app roles');
select ok(has_table_privilege('anon', 'public.events', 'SELECT'), 'public event reads remain available subject to RLS');
select ok(has_column_privilege('authenticated', 'public.events', 'name', 'INSERT'), 'event name remains insertable');
select ok(not has_column_privilege('authenticated', 'public.events', 'event_code', 'INSERT'), 'event code is database-generated');
select ok(not has_column_privilege('authenticated', 'public.events', 'status', 'INSERT'), 'event status is server-managed');
select ok(has_column_privilege('authenticated', 'public.events', 'venue', 'UPDATE'), 'draft event venue remains editable');
select ok(not has_column_privilege('authenticated', 'public.events', 'organizer_id', 'UPDATE'), 'event ownership cannot be reassigned');
select ok(not has_column_privilege('authenticated', 'public.events', 'status', 'UPDATE'), 'event lifecycle cannot be changed by clients');
select ok(not has_column_privilege('authenticated', 'public.events', 'updated_at', 'UPDATE'), 'event timestamps cannot be changed by clients');

select ok(not has_table_privilege('anon', 'public.event_documents', 'INSERT'), 'anon cannot insert event documents');
select ok(not has_table_privilege('authenticated', 'public.event_documents', 'INSERT'), 'document insert is column-scoped');
select ok(not has_table_privilege('authenticated', 'public.event_documents', 'UPDATE'), 'documents cannot be updated by organizers');
select ok(has_table_privilege('authenticated', 'public.event_documents', 'DELETE'), 'document deletion is available subject to draft-owner RLS');
select ok(not has_table_privilege('authenticated', 'public.event_documents', 'TRUNCATE'), 'documents cannot be truncated by app roles');
select ok(not has_table_privilege('authenticated', 'public.event_documents', 'MAINTAIN'), 'documents cannot be maintained by app roles');
select ok(has_table_privilege('authenticated', 'public.event_documents', 'SELECT'), 'document reads remain available subject to RLS');
select ok(has_column_privilege('authenticated', 'public.event_documents', 'storage_path', 'INSERT'), 'document path remains insertable subject to RLS');
select ok(not has_column_privilege('authenticated', 'public.event_documents', 'verification_status', 'INSERT'), 'document review status is protected');
select ok(not has_column_privilege('authenticated', 'public.event_documents', 'reviewed_by', 'INSERT'), 'document reviewer is protected');

select ok(has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE'), 'profile name remains editable');
select ok(has_column_privilege('authenticated', 'public.profiles', 'phone', 'UPDATE'), 'profile phone remains editable');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'is_active', 'UPDATE'), 'profile active flag is protected');

select ok(not has_table_privilege('anon', 'public.user_roles', 'INSERT'), 'anon cannot assign roles');
select ok(not has_table_privilege('authenticated', 'public.user_roles', 'INSERT'), 'authenticated users cannot assign roles');
select ok(not has_table_privilege('authenticated', 'public.event_date_locks', 'INSERT'), 'date locks remain function-only writes');
select ok(not has_table_privilege('authenticated', 'public.payments', 'UPDATE'), 'payments remain function-only writes');
select ok(not has_table_privilege('authenticated', 'public.refunds', 'UPDATE'), 'refunds remain function-only writes');
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT'), 'audit logs remain function-only writes');

select ok(not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'INSERT' and (roles @> array['anon']::name[] or roles @> array['public']::name[])), 'anon has no Storage insert policy');
select ok(not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'UPDATE' and (roles @> array['authenticated']::name[] or roles @> array['public']::name[])), 'app clients have no Storage update policy');
select ok(has_table_privilege('authenticated', 'storage.objects', 'INSERT'), 'Storage inserts remain available subject to object RLS');
select ok(has_table_privilege('authenticated', 'storage.objects', 'DELETE'), 'Storage deletes remain available subject to object RLS');

select ok(to_regprocedure('public.set_organizer_verification(uuid,public.verification_status)') is not null, 'verification function has expected signature');
select ok((select prosecdef from pg_proc where oid = to_regprocedure('public.set_organizer_verification(uuid,public.verification_status)')), 'verification function is SECURITY DEFINER');
select ok((select proconfig @> array['search_path=""'] from pg_proc where oid = to_regprocedure('public.set_organizer_verification(uuid,public.verification_status)')), 'verification function pins an empty search_path');
select ok(not has_function_privilege('anon', to_regprocedure('public.set_organizer_verification(uuid,public.verification_status)'), 'EXECUTE'), 'anon cannot execute verification');
select ok(not exists (
  select 1
  from pg_proc p
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  where p.oid = to_regprocedure('public.set_organizer_verification(uuid,public.verification_status)')
    and acl.grantee = 0
    and acl.privilege_type = 'EXECUTE'
), 'PUBLIC cannot execute verification');
select ok(has_function_privilege('authenticated', to_regprocedure('public.set_organizer_verification(uuid,public.verification_status)'), 'EXECUTE'), 'authenticated RPC checks staff role internally');
select ok((select has_table_privilege(proowner, 'public.organizers', 'UPDATE') and has_table_privilege(proowner, 'public.audit_logs', 'INSERT') from pg_proc where oid = to_regprocedure('public.set_organizer_verification(uuid,public.verification_status)')), 'verification function owner can update organizers and append audit logs');

select ok((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'events' and policyname = 'events_update_own_draft' and cmd = 'UPDATE' and roles @> array['authenticated']::name[] and qual ilike '%DRAFT%' and qual ilike '%auth.uid%' and with_check ilike '%DRAFT%' and with_check ilike '%auth.uid%'), 'event updates are owner-scoped and DRAFT-only');
select ok((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'event_documents' and policyname = 'docs_insert_own' and cmd = 'INSERT' and with_check ilike '%DRAFT%' and with_check ilike '%auth.uid%' and with_check ilike '%storage_path%' and with_check ilike '%event_id%'), 'document inserts are owner-scoped, path-bound, and DRAFT-only');
select ok((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'event_documents' and policyname = 'docs_delete_own' and cmd = 'DELETE' and qual ilike '%DRAFT%' and qual ilike '%auth.uid%'), 'document deletes are owner-scoped and DRAFT-only');
select ok((select count(*) = 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'docs_upload_owner' and cmd = 'INSERT' and with_check ilike '%organizer-documents%' and with_check ilike '%DRAFT%' and with_check ilike '%auth.uid%'), 'document uploads are bucket-, event-, owner-, and DRAFT-scoped');
select ok((select count(*) = 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'docs_delete_owner' and cmd = 'DELETE' and qual ilike '%organizer-documents%' and qual ilike '%DRAFT%' and qual ilike '%auth.uid%'), 'document deletes are bucket-, event-, owner-, and DRAFT-scoped');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'proofs_upload_owner'), 'payment-proof upload policy is preserved');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'proofs_read_owner_or_staff'), 'payment-proof read policy is preserved');

select * from finish();
rollback;