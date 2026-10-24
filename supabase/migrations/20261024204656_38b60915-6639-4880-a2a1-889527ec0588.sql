create or replace function public.release_expired_holds()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select distinct l.event_id from public.event_date_locks l
    where l.lock_type = 'TEMPORARY_HOLD' and l.expires_at is not null and l.expires_at < now()
  loop
    delete from public.event_date_locks where event_id = r.event_id and lock_type = 'TEMPORARY_HOLD';
    update public.events set status = 'CANCELLED', updated_at = now()
      where id = r.event_id and status = 'PENDING_PAYMENT';
    if found then
      insert into public.event_status_history (event_id, from_status, to_status, actor_id, reason)
      values (r.event_id, 'PENDING_PAYMENT', 'CANCELLED', null, 'Batas waktu pembayaran deposit habis');
    end if;
  end loop;
end; $$;
revoke all on function public.release_expired_holds() from public, anon, authenticated;

create or replace function public.get_region_availability(_region_id uuid, _from date, _to date)
returns table (event_date date, lock_type public.lock_type)
language sql stable security definer set search_path = public as $$
  select l.event_date, l.lock_type from public.event_date_locks l
  where l.region_id = _region_id and l.event_date between _from and _to
    and (_to - _from) <= 400
    and not (l.lock_type = 'TEMPORARY_HOLD' and l.expires_at is not null and l.expires_at < now())
$$;
grant execute on function public.get_region_availability(uuid, date, date) to anon, authenticated;

create or replace function public.submit_proposal(_event_id uuid)
returns public.events language plpgsql security definer set search_path = public as $$
declare
  e public.events;
  d date;
  today date := (now() at time zone 'Asia/Makassar')::date;
begin
  select ev.* into e from public.events ev
    join public.organizers o on o.id = ev.organizer_id
    where ev.id = _event_id and o.owner_id = auth.uid()
    for update of ev;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if e.status <> 'DRAFT' then raise exception 'INVALID_STATUS'; end if;
  if e.end_date < e.start_date then raise exception 'INVALID_DATES'; end if;
  if e.start_date <= today then raise exception 'DATE_IN_PAST'; end if;
  if e.end_date - e.start_date > 6 then raise exception 'RANGE_TOO_LONG'; end if;
  if not exists (select 1 from public.regions where id = e.region_id and is_active) then
    raise exception 'REGION_INACTIVE'; end if;

  perform public.release_expired_holds();

  begin
    d := e.start_date;
    while d <= e.end_date loop
      insert into public.event_date_locks (region_id, event_date, event_id, lock_type, expires_at)
      values (e.region_id, d, e.id, 'TEMPORARY_HOLD', now() + interval '24 hours');
      d := d + 1;
    end loop;
  exception when unique_violation then
    raise exception 'DATE_TAKEN';
  end;

  update public.events set status = 'PENDING_PAYMENT', submitted_at = now(), updated_at = now()
    where id = e.id returning * into e;
  insert into public.event_status_history (event_id, from_status, to_status, actor_id, reason)
    values (e.id, 'DRAFT', 'PENDING_PAYMENT', auth.uid(), 'Proposal diajukan');
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'PROPOSAL_SUBMITTED', 'event', e.id,
      jsonb_build_object('region_id', e.region_id, 'start_date', e.start_date, 'end_date', e.end_date));
  return e;
end; $$;
revoke all on function public.submit_proposal(uuid) from public, anon;
grant execute on function public.submit_proposal(uuid) to authenticated;