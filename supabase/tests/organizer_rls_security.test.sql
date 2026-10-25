begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@example.invalid', '', now(), '{}', '{"full_name":"Owner A"}', now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@example.invalid', '', now(), '{}', '{"full_name":"Owner B"}', now(), now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.invalid', '', now(), '{}', '{"full_name":"Dummy Admin"}', now(), now());

insert into public.user_roles (user_id, role)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'admin_event');

insert into public.organizers (id, owner_id, organization_name, contact_person)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Dummy Org A', 'Contact A'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Dummy Org B', 'Contact B');

insert into public.events (
  id, organizer_id, region_id, name, start_date, end_date, venue, event_type, participant_category
) values
  ('aaaaaaaa-0000-4000-8000-000000001001', 'aaaaaaaa-0000-4000-8000-000000000001', (select id from public.regions where kemendagri_code = '73.71'), 'Draft A', '2030-01-01', '2030-01-01', 'Dummy Venue', 'Turnamen', 'Umum'),
  ('bbbbbbbb-0000-4000-8000-000000001001', 'bbbbbbbb-0000-4000-8000-000000000001', (select id from public.regions where kemendagri_code = '73.71'), 'Draft B', '2030-01-02', '2030-01-02', 'Dummy Venue', 'Turnamen', 'Umum'),
  ('aaaaaaaa-0000-4000-8000-000000001002', 'aaaaaaaa-0000-4000-8000-000000000001', (select id from public.regions where kemendagri_code = '73.71'), 'Submitted A', '2030-01-03', '2030-01-03', 'Dummy Venue', 'Turnamen', 'Umum');
update public.events set status = 'PENDING_PAYMENT' where id = 'aaaaaaaa-0000-4000-8000-000000001002';

insert into public.event_documents (event_id, document_type, storage_path)
values ('aaaaaaaa-0000-4000-8000-000000001002', 'SUPPORTING_DOCUMENT', 'aaaaaaaa-0000-4000-8000-000000001002/submitted.pdf');

insert into storage.buckets (id, name, public, file_size_limit)
values ('organizer-documents', 'organizer-documents', false, 10485760)
on conflict (id) do nothing;

set local role anon;
select throws_ok(
  $$insert into public.organizers (owner_id, organization_name, contact_person) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Anon Org', 'Anon')$$,
  '42501', null, 'anon cannot create an organizer'
);
select throws_ok(
  $$insert into public.events (organizer_id, region_id, name, start_date, end_date, venue, event_type, participant_category) values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.regions where kemendagri_code = '73.71'), 'Anon Event', '2030-01-04', '2030-01-04', 'Dummy Venue', 'Turnamen', 'Umum')$$,
  '42501', null, 'anon cannot create an event'
);
select throws_ok(
  $$insert into public.event_documents (event_id, document_type, storage_path) values ('aaaaaaaa-0000-4000-8000-000000001001', 'SUPPORTING_DOCUMENT', 'aaaaaaaa-0000-4000-8000-000000001001/anon.pdf')$$,
  '42501', null, 'anon cannot create event documents'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('organizer-documents', 'aaaaaaaa-0000-4000-8000-000000001001/anon.pdf')$$,
  '42501', null, 'anon cannot upload organizer documents'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select results_eq(
  $$update public.organizers set contact_person = 'Contact A Updated' where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning contact_person$$,
  array['Contact A Updated'], 'owner can update permitted organizer fields'
);
select throws_ok(
  $$update public.organizers set owner_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', null, 'owner cannot reassign organizer ownership'
);
select throws_ok(
  $$update public.organizers set verification_status = 'VERIFIED' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', null, 'owner cannot set organizer verification'
);

select results_eq(
  $$insert into public.events (organizer_id, region_id, name, start_date, end_date, venue, event_type, participant_category) values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.regions where kemendagri_code = '73.71'), 'Owner Draft', '2030-01-05', '2030-01-05', 'Dummy Venue', 'Turnamen', 'Umum') returning name$$,
  array['Owner Draft'], 'owner can create an event draft'
);
select results_eq(
  $$update public.events set name = 'Owner Draft Updated' where id = 'aaaaaaaa-0000-4000-8000-000000001001' returning name$$,
  array['Owner Draft Updated'], 'owner can edit own DRAFT event'
);
select throws_ok(
  $$insert into public.events (organizer_id, region_id, event_code, status, name, start_date, end_date, venue, event_type, participant_category) values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.regions where kemendagri_code = '73.71'), 'AFP-99999', 'APPROVED', 'Forged Event', '2030-01-06', '2030-01-06', 'Dummy Venue', 'Turnamen', 'Umum')$$,
  '42501', null, 'owner cannot set generated event code or lifecycle status'
);
select is_empty(
  $$select id from public.events where id = 'bbbbbbbb-0000-4000-8000-000000001001'$$,
  'owner cannot read another organizer event'
);
select is_empty(
  $$update public.events set name = 'Stolen Draft' where id = 'bbbbbbbb-0000-4000-8000-000000001001' returning id$$,
  'owner cannot update another organizer event'
);
select is_empty(
  $$update public.events set name = 'Edit Submitted' where id = 'aaaaaaaa-0000-4000-8000-000000001002' returning id$$,
  'owner cannot update a non-DRAFT event'
);
select results_eq(
  $$insert into public.event_documents (event_id, document_type, storage_path) values ('aaaaaaaa-0000-4000-8000-000000001001', 'SUPPORTING_DOCUMENT', 'aaaaaaaa-0000-4000-8000-000000001001/owner.pdf') returning storage_path$$,
  array['aaaaaaaa-0000-4000-8000-000000001001/owner.pdf'], 'owner can attach a document to own DRAFT event'
);
select throws_ok(
  $$insert into public.event_documents (event_id, document_type, storage_path) values ('aaaaaaaa-0000-4000-8000-000000001001', 'SUPPORTING_DOCUMENT', 'bbbbbbbb-0000-4000-8000-000000001001/wrong-event.pdf')$$,
  '42501', null, 'owner cannot attach a path for another event'
);
select throws_ok(
  $$insert into public.event_documents (event_id, document_type, storage_path, verification_status) values ('aaaaaaaa-0000-4000-8000-000000001001', 'SUPPORTING_DOCUMENT', 'aaaaaaaa-0000-4000-8000-000000001001/forged.pdf', 'VERIFIED')$$,
  '42501', null, 'owner cannot set document review status'
);
select is_empty(
  $$delete from public.event_documents where event_id = 'aaaaaaaa-0000-4000-8000-000000001002' returning id$$,
  'owner cannot delete a submitted event document'
);
select throws_ok(
  $$select public.set_organizer_verification('aaaaaaaa-0000-4000-8000-000000000001', 'VERIFIED')$$,
  'P0001', 'UNAUTHORIZED', 'ordinary organizer cannot execute privileged verification'
);
select throws_ok(
  $$select public.set_event_document_review((select id from public.event_documents where event_id = 'aaaaaaaa-0000-4000-8000-000000001002'), 'VERIFIED')$$,
  'P0001', 'UNAUTHORIZED', 'ordinary organizer cannot review a document'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('organizer-documents', 'bbbbbbbb-0000-4000-8000-000000001001/forged.pdf')$$,
  '42501', null, 'organizer cannot upload under another event path'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('organizer-documents', 'aaaaaaaa-0000-4000-8000-000000001002/submitted.pdf')$$,
  '42501', null, 'organizer cannot upload for a submitted event'
);
select results_eq(
  $$insert into storage.objects (bucket_id, name) values ('organizer-documents', 'aaaaaaaa-0000-4000-8000-000000001001/owner.pdf') returning name$$,
  array['aaaaaaaa-0000-4000-8000-000000001001/owner.pdf'], 'owner can upload under own DRAFT event path'
);

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is_empty(
  $$delete from public.event_documents where event_id = 'aaaaaaaa-0000-4000-8000-000000001001' returning id$$,
  'second organizer cannot delete first organizer document row'
);
select is_empty(
  $$select name from storage.objects where bucket_id = 'organizer-documents' and name = 'aaaaaaaa-0000-4000-8000-000000001001/owner.pdf'$$,
  'second organizer cannot read first organizer storage object'
);
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select results_eq(
  $$select verification_status::text from public.set_organizer_verification('aaaaaaaa-0000-4000-8000-000000000001', 'VERIFIED')$$,
  array['VERIFIED'], 'authorized admin can verify an organizer'
);
select results_eq(
  $$select verification_status::text from public.set_event_document_review((select id from public.event_documents where event_id = 'aaaaaaaa-0000-4000-8000-000000001002'), 'VERIFIED')$$,
  array['VERIFIED'], 'authorized admin can review a document'
);

reset role;
select ok(exists (
  select 1 from public.audit_logs
  where entity_id = 'aaaaaaaa-0000-4000-8000-000000000001'
    and actor_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    and action = 'ORGANIZER_VERIFICATION_UPDATED'
), 'verification action is recorded in audit_logs');
select ok(exists (
  select 1 from public.audit_logs
  where entity_id = (select id from public.event_documents where event_id = 'aaaaaaaa-0000-4000-8000-000000001002')
    and actor_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    and action = 'EVENT_DOCUMENT_REVIEWED'
), 'document review is recorded in audit_logs');

select * from finish();
rollback;