-- Keep user-editable organizer details separate from staff-managed verification.
revoke all privileges on table
	public.organizers,
	public.events,
	public.event_documents,
	public.event_date_locks,
	public.payments,
	public.refunds,
	public.audit_logs,
	public.user_roles,
	public.profiles,
	storage.objects
	from public, anon, authenticated;

grant select on public.organizers, public.profiles, public.user_roles,
	public.payments, public.refunds, public.audit_logs to authenticated;
grant select on public.events to anon, authenticated;
grant select on public.event_date_locks to anon, authenticated;
grant select, delete on public.event_documents to authenticated;
grant select, insert, delete on storage.objects to authenticated;

revoke maintain on table
	public.organizers,
	public.events,
	public.event_documents,
	public.event_date_locks,
	public.payments,
	public.refunds,
	public.audit_logs,
	public.user_roles,
	public.profiles
	from public, anon, authenticated;

do $$
declare
	target record;
	column_name text;
begin
	for target in
		select * from (values
			('public', 'organizers'),
			('public', 'events'),
			('public', 'event_documents'),
			('public', 'event_date_locks'),
			('public', 'payments'),
			('public', 'refunds'),
			('public', 'audit_logs'),
			('public', 'user_roles'),
			('public', 'profiles'),
			('storage', 'objects')
		) as scoped_tables(schema_name, table_name)
	loop
		for column_name in
			select attname
			from pg_attribute
			where attrelid = to_regclass(format('%I.%I', target.schema_name, target.table_name))
				and attnum > 0
				and not attisdropped
		loop
			execute format(
				'revoke all privileges (%I) on table %I.%I from public, anon, authenticated',
				column_name,
				target.schema_name,
				target.table_name
			);
		end loop;
	end loop;
end;
$$;

revoke insert, update, delete, truncate, references, trigger
	on public.organizers from public, anon, authenticated;
grant insert (owner_id, organization_name, legal_id, contact_person, contact_phone)
	on public.organizers to authenticated;
grant update (organization_name, legal_id, contact_person, contact_phone)
	on public.organizers to authenticated;

-- Profiles and role data are readable per existing policies; writes stay narrow.
revoke insert, update, delete, truncate, references, trigger
	on public.profiles from public, anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

revoke insert, update, delete, truncate, references, trigger
	on public.user_roles from public, anon, authenticated;

-- Date locks and financial/audit records are writable only through trusted functions.
revoke insert, update, delete, truncate, references, trigger
	on public.event_date_locks, public.payments, public.refunds, public.audit_logs
	from public, anon, authenticated;

-- Event codes and lifecycle state are database-managed, not client inputs.
revoke insert, update, delete, truncate, references, trigger
	on public.events from public, anon, authenticated;
grant insert (
	organizer_id,
	region_id,
	name,
	description,
	start_date,
	end_date,
	venue,
	event_type,
	participant_category,
	estimated_participants
) on public.events to authenticated;
grant update (
	region_id,
	name,
	description,
	start_date,
	end_date,
	venue,
	event_type,
	participant_category,
	estimated_participants
) on public.events to authenticated;

create policy "events_update_own_draft" on public.events
	for update to authenticated
	using (
		status = 'DRAFT' and exists (
			select 1 from public.organizers o
			where o.id = events.organizer_id and o.owner_id = auth.uid()
		)
	)
	with check (
		status = 'DRAFT' and exists (
			select 1 from public.organizers o
			where o.id = events.organizer_id and o.owner_id = auth.uid()
		)
	);

-- Uploaded documents begin unreviewed; owners cannot set staff review fields.
revoke insert, update, delete, truncate, references, trigger
	on public.event_documents from public, anon, authenticated;
grant select, delete on public.event_documents to authenticated;
grant insert (event_id, document_type, storage_path)
	on public.event_documents to authenticated;

-- Supabase manages baseline storage.objects ACLs; Storage RLS limits the allowed objects.
revoke insert, update, delete, truncate, references, trigger
	on storage.objects from public, anon, authenticated;
grant select, insert, delete on storage.objects to authenticated;

drop policy "docs_insert_own" on public.event_documents;
create policy "docs_insert_own" on public.event_documents
	for insert to authenticated
	with check (exists (
		select 1 from public.events e
		join public.organizers o on o.id = e.organizer_id
		where e.id = event_documents.event_id
			and o.owner_id = auth.uid()
			and e.status = 'DRAFT'
			and event_documents.storage_path like event_documents.event_id::text || '/%'
	));

drop policy "docs_delete_own" on public.event_documents;
create policy "docs_delete_own" on public.event_documents
	for delete to authenticated
	using (exists (
		select 1 from public.events e
		join public.organizers o on o.id = e.organizer_id
		where e.id = event_documents.event_id
			and o.owner_id = auth.uid()
			and e.status = 'DRAFT'
	));

drop policy "docs_upload_owner" on storage.objects;
create policy "docs_upload_owner" on storage.objects
	for insert to authenticated
	with check (
		bucket_id = 'organizer-documents'
		and exists (
			select 1 from public.events e
			join public.organizers o on o.id = e.organizer_id
			where e.id::text = (storage.foldername(name))[1]
				and o.owner_id = auth.uid()
				and e.status = 'DRAFT'
		)
	);

drop policy "docs_delete_owner" on storage.objects;
create policy "docs_delete_owner" on storage.objects
	for delete to authenticated
	using (
		bucket_id = 'organizer-documents'
		and exists (
			select 1 from public.events e
			join public.organizers o on o.id = e.organizer_id
			where e.id::text = (storage.foldername(name))[1]
				and o.owner_id = auth.uid()
				and e.status = 'DRAFT'
		)
	);

create or replace function public.set_organizer_verification(
	_organizer_id uuid,
	_status public.verification_status
)
returns public.organizers
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_organizer public.organizers;
begin
	if auth.uid() is null
		or not (
			public.has_role(auth.uid(), 'admin_event')
			or public.has_role(auth.uid(), 'super_admin')
		) then
		raise exception 'UNAUTHORIZED';
	end if;

	update public.organizers
		set verification_status = _status
		where id = _organizer_id
		returning * into v_organizer;

	if not found then
		raise exception 'ORGANIZER_NOT_FOUND';
	end if;

	insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
		values (
			auth.uid(),
			'ORGANIZER_VERIFICATION_UPDATED',
			'organizer',
			v_organizer.id,
			jsonb_build_object('verification_status', _status)
		);

	return v_organizer;
end;
$$;

revoke all on function public.set_organizer_verification(uuid, public.verification_status)
	from public, anon;
grant execute on function public.set_organizer_verification(uuid, public.verification_status)
	to authenticated;
