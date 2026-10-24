-- ============ AFP SULSEL PHASE 1: SCHEMA, ROLES, RLS ============

create type public.app_role as enum ('organizer','admin_event','finance','super_admin');
create type public.region_type as enum ('KABUPATEN','KOTA');
create type public.verification_status as enum ('PENDING','VERIFIED','REJECTED');
create type public.application_status as enum ('DRAFT','PENDING_PAYMENT','PENDING_ADMIN','APPROVED','REJECTED','CANCELLED','COMPLETED');
create type public.payment_method as enum ('GATEWAY','MANUAL_TRANSFER');
create type public.payment_status as enum ('PENDING','PROCESSING','PAID','FAILED','EXPIRED','REFUND_PENDING','REFUNDED','DISPUTED');
create type public.lock_type as enum ('TEMPORARY_HOLD','PAYMENT_VERIFIED','APPROVED');
create type public.refund_status as enum ('PENDING','PROCESSING','COMPLETED','FAILED','REJECTED');
create type public.doc_status as enum ('PENDING','VERIFIED','REJECTED');
create type public.webhook_status as enum ('RECEIVED','PROCESSING','PROCESSED','FAILED');

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ TABLES ============

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create table public.organizers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  organization_name text not null,
  legal_id text,
  contact_person text not null,
  contact_phone text,
  verification_status public.verification_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_type public.region_type not null,
  province_code text not null default '73',
  kemendagri_code text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create sequence public.event_code_seq start 1000;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique default 'AFP-' || lpad(nextval('public.event_code_seq')::text, 5, '0'),
  organizer_id uuid not null references public.organizers(id) on delete restrict,
  region_id uuid not null references public.regions(id) on delete restrict,
  name text not null,
  description text,
  start_date date not null,
  end_date date not null,
  venue text not null,
  event_type text not null,
  participant_category text not null,
  estimated_participants integer not null default 0 check (estimated_participants >= 0),
  status public.application_status not null default 'DRAFT',
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_date_order check (start_date <= end_date)
);

create table public.event_date_locks (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete restrict,
  event_date date not null,
  event_id uuid not null references public.events(id) on delete restrict,
  lock_type public.lock_type not null default 'TEMPORARY_HOLD',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region_id, event_date)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  amount_idr integer not null check (amount_idr > 0),
  currency text not null default 'IDR' check (currency = 'IDR'),
  method public.payment_method not null,
  status public.payment_status not null default 'PENDING',
  provider text,
  provider_reference text,
  idempotency_key text unique,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  received_at timestamptz not null default now(),
  processing_status public.webhook_status not null default 'RECEIVED',
  processed_at timestamptz,
  error_summary text,
  unique (provider, provider_event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  amount_idr integer not null check (amount_idr > 0),
  reason text not null,
  status public.refund_status not null default 'PENDING',
  provider_reference text,
  initiated_by uuid references public.profiles(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  document_type text not null,
  storage_path text not null,
  verification_status public.doc_status not null default 'PENDING',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.event_status_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  from_status public.application_status,
  to_status public.application_status not null,
  actor_id uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ============ GRANTS ============

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
grant select, insert, update, delete on public.organizers to authenticated;
grant all on public.organizers to service_role;
grant select on public.regions to anon, authenticated;
grant all on public.regions to service_role;
grant select, insert, delete on public.events to authenticated;
grant select on public.events to anon;
grant all on public.events to service_role;
grant select on public.event_date_locks to anon, authenticated;
grant all on public.event_date_locks to service_role;
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
grant all on public.payment_webhook_events to service_role;
grant select on public.refunds to authenticated;
grant all on public.refunds to service_role;
grant select, insert, delete on public.event_documents to authenticated;
grant all on public.event_documents to service_role;
grant select on public.event_status_history to authenticated;
grant all on public.event_status_history to service_role;
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
grant select on public.system_settings to authenticated;
grant all on public.system_settings to service_role;
grant usage, select on sequence public.event_code_seq to authenticated, service_role;

-- ============ ROLE HELPERS ============

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('admin_event','finance','super_admin')
  )
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'super_admin')
$$;

grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_super_admin() to anon, authenticated;

-- ============ RLS ============

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.organizers enable row level security;
alter table public.regions enable row level security;
alter table public.events enable row level security;
alter table public.event_date_locks enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.refunds enable row level security;
alter table public.event_documents enable row level security;
alter table public.event_status_history enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.system_settings enable row level security;

-- profiles
create policy "profiles_select_own_or_staff" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_update_super_admin" on public.profiles
  for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- user_roles
create policy "user_roles_select_own_or_super" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

-- organizers
create policy "organizers_select_own_or_staff" on public.organizers
  for select to authenticated
  using (owner_id = auth.uid() or public.is_staff());
create policy "organizers_insert_own" on public.organizers
  for insert to authenticated
  with check (owner_id = auth.uid());
create policy "organizers_update_own" on public.organizers
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "organizers_update_super_admin" on public.organizers
  for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- regions
create policy "regions_public_read_active" on public.regions
  for select to anon, authenticated
  using (is_active = true);
create policy "regions_staff_read_all" on public.regions
  for select to authenticated
  using (public.is_staff());
create policy "regions_write_super_admin" on public.regions
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- events
create policy "events_public_read_approved" on public.events
  for select to anon
  using (status = 'APPROVED');
create policy "events_select_own" on public.events
  for select to authenticated
  using (exists (
    select 1 from public.organizers o
    where o.id = events.organizer_id and o.owner_id = auth.uid()
  ));
create policy "events_select_staff" on public.events
  for select to authenticated
  using (public.is_staff());
create policy "events_insert_own_draft" on public.events
  for insert to authenticated
  with check (
    status = 'DRAFT' and exists (
      select 1 from public.organizers o
      where o.id = events.organizer_id and o.owner_id = auth.uid()
    )
  );

-- event_date_locks: writes only through protected server functions
create policy "locks_public_read_approved" on public.event_date_locks
  for select to anon
  using (exists (
    select 1 from public.events e
    where e.id = event_date_locks.event_id and e.status = 'APPROVED'
  ));
create policy "locks_select_own" on public.event_date_locks
  for select to authenticated
  using (exists (
    select 1 from public.events e
    join public.organizers o on o.id = e.organizer_id
    where e.id = event_date_locks.event_id and o.owner_id = auth.uid()
  ) or public.is_staff());

-- payments: read-only for organizers and staff; writes through protected functions
create policy "payments_select" on public.payments
  for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.events e
    join public.organizers o on o.id = e.organizer_id
    where e.id = payments.event_id and o.owner_id = auth.uid()
  ));

-- refunds: read-only for organizers and staff; writes through protected functions
create policy "refunds_select" on public.refunds
  for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.payments p
    join public.events e on e.id = p.event_id
    join public.organizers o on o.id = e.organizer_id
    where p.id = refunds.payment_id and o.owner_id = auth.uid()
  ));

-- event_documents
create policy "docs_select_own_or_staff" on public.event_documents
  for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.events e
    join public.organizers o on o.id = e.organizer_id
    where e.id = event_documents.event_id and o.owner_id = auth.uid()
  ));
create policy "docs_insert_own" on public.event_documents
  for insert to authenticated
  with check (exists (
    select 1 from public.events e
    join public.organizers o on o.id = e.organizer_id
    where e.id = event_documents.event_id and o.owner_id = auth.uid()
  ));
create policy "docs_update_staff" on public.event_documents
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "docs_delete_own" on public.event_documents
  for delete to authenticated
  using (exists (
    select 1 from public.events e
    join public.organizers o on o.id = e.organizer_id
    where e.id = event_documents.event_id and o.owner_id = auth.uid()
  ));

-- event_status_history: read-only
create policy "history_select_own_or_staff" on public.event_status_history
  for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.events e
    join public.organizers o on o.id = e.organizer_id
    where e.id = event_status_history.event_id and o.owner_id = auth.uid()
  ));

-- audit_logs: read-only, super admin only
create policy "audit_select_super_admin" on public.audit_logs
  for select to authenticated
  using (public.is_super_admin());

create or replace function public.prevent_audit_mutation() returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'audit_logs bersifat append-only dan tidak dapat diubah atau dihapus';
end;
$$;
create trigger audit_logs_no_mutation
  before update or delete on public.audit_logs
  for each row execute function public.prevent_audit_mutation();

-- notifications
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- system_settings
create policy "settings_select_authenticated" on public.system_settings
  for select to authenticated
  using (true);
create policy "settings_write_super_admin" on public.system_settings
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ============ UPDATED_AT TRIGGERS ============

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger organizers_updated_at before update on public.organizers
  for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger locks_updated_at before update on public.event_date_locks
  for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger refunds_updated_at before update on public.refunds
  for each row execute function public.set_updated_at();

-- ============ NEW USER BOOTSTRAP ============

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.user_roles (user_id, role)
  values (new.id, 'organizer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ STORAGE POLICIES (private buckets) ============

create policy "docs_upload_owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'organizer-documents'
    and exists (
      select 1 from public.events e
      join public.organizers o on o.id = e.organizer_id
      where e.id::text = (storage.foldername(name))[1]
        and o.owner_id = auth.uid()
    )
  );
create policy "docs_read_owner_or_staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'organizer-documents'
    and (
      exists (
        select 1 from public.events e
        join public.organizers o on o.id = e.organizer_id
        where e.id::text = (storage.foldername(name))[1]
          and o.owner_id = auth.uid()
      )
      or public.is_staff()
    )
  );
create policy "docs_delete_owner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'organizer-documents'
    and exists (
      select 1 from public.events e
      join public.organizers o on o.id = e.organizer_id
      where e.id::text = (storage.foldername(name))[1]
        and o.owner_id = auth.uid()
    )
  );

create policy "proofs_upload_owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.events e
      join public.organizers o on o.id = e.organizer_id
      where e.id::text = (storage.foldername(name))[1]
        and o.owner_id = auth.uid()
    )
  );
create policy "proofs_read_owner_or_staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      exists (
        select 1 from public.events e
        join public.organizers o on o.id = e.organizer_id
        where e.id::text = (storage.foldername(name))[1]
          and o.owner_id = auth.uid()
      )
      or public.is_staff()
    )
  );

-- ============ REGION SEED: official 24 Kemendagri regions of South Sulawesi ============

insert into public.regions (name, region_type, province_code, kemendagri_code, is_active) values
  ('Kabupaten Kepulauan Selayar', 'KABUPATEN', '73', '73.01', true),
  ('Kabupaten Bulukumba', 'KABUPATEN', '73', '73.02', true),
  ('Kabupaten Bantaeng', 'KABUPATEN', '73', '73.03', true),
  ('Kabupaten Jeneponto', 'KABUPATEN', '73', '73.04', true),
  ('Kabupaten Takalar', 'KABUPATEN', '73', '73.05', true),
  ('Kabupaten Gowa', 'KABUPATEN', '73', '73.06', true),
  ('Kabupaten Sinjai', 'KABUPATEN', '73', '73.07', true),
  ('Kabupaten Maros', 'KABUPATEN', '73', '73.08', true),
  ('Kabupaten Pangkajene dan Kepulauan', 'KABUPATEN', '73', '73.09', true),
  ('Kabupaten Barru', 'KABUPATEN', '73', '73.10', true),
  ('Kabupaten Bone', 'KABUPATEN', '73', '73.11', true),
  ('Kabupaten Soppeng', 'KABUPATEN', '73', '73.12', true),
  ('Kabupaten Wajo', 'KABUPATEN', '73', '73.13', true),
  ('Kabupaten Sidenreng Rappang', 'KABUPATEN', '73', '73.14', true),
  ('Kabupaten Pinrang', 'KABUPATEN', '73', '73.15', true),
  ('Kabupaten Enrekang', 'KABUPATEN', '73', '73.16', true),
  ('Kabupaten Luwu', 'KABUPATEN', '73', '73.17', true),
  ('Kabupaten Tana Toraja', 'KABUPATEN', '73', '73.18', true),
  ('Kabupaten Luwu Utara', 'KABUPATEN', '73', '73.19', true),
  ('Kabupaten Luwu Timur', 'KABUPATEN', '73', '73.20', true),
  ('Kabupaten Toraja Utara', 'KABUPATEN', '73', '73.21', true),
  ('Kota Makassar', 'KOTA', '73', '73.71', true),
  ('Kota Parepare', 'KOTA', '73', '73.72', true),
  ('Kota Palopo', 'KOTA', '73', '73.73', true);

-- ============ INDEXES ============

create index idx_events_region_dates on public.events (region_id, start_date, end_date);
create index idx_events_status on public.events (status);
create index idx_events_organizer on public.events (organizer_id);
create index idx_locks_event on public.event_date_locks (event_id);
create index idx_locks_expires on public.event_date_locks (expires_at) where lock_type = 'TEMPORARY_HOLD';
create index idx_payments_event on public.payments (event_id);
create index idx_payments_status on public.payments (status);
create index idx_payments_provider_ref on public.payments (provider, provider_reference);
create index idx_webhooks_received on public.payment_webhook_events (received_at);
create index idx_refunds_payment on public.refunds (payment_id);
create index idx_refunds_status on public.refunds (status);
create index idx_docs_event on public.event_documents (event_id);
create index idx_history_event on public.event_status_history (event_id);
create index idx_audit_entity on public.audit_logs (entity_type, entity_id);
create index idx_audit_actor on public.audit_logs (actor_id);
create index idx_notif_user on public.notifications (user_id, read_at);
create index idx_user_roles_user on public.user_roles (user_id);
create index idx_organizers_owner on public.organizers (owner_id);