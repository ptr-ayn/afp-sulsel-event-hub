alter table public.payments add column environment text not null default 'sandbox' check (environment in ('sandbox','live')), add column checkout_url text, add column expires_at timestamptz, add column proof_path text;
create unique index payments_provider_reference_unique on public.payments(provider, provider_reference) where provider_reference is not null;

create or replace function public.begin_deposit(_event_id uuid, _provider text) returns public.payments language plpgsql security definer set search_path = '' as $$
declare e public.events; p public.payments;
begin
 select ev.* into e from public.events ev join public.organizers o on o.id=ev.organizer_id where ev.id=_event_id and o.owner_id=auth.uid() for update of ev;
 if not found then raise exception 'EVENT_NOT_FOUND'; end if;
 if e.status <> 'PENDING_PAYMENT' then raise exception 'INVALID_STATUS'; end if;
 if _provider not in ('midtrans','xendit','manual') then raise exception 'INVALID_PROVIDER'; end if;
 if exists(select 1 from public.event_date_locks where event_id=e.id and lock_type='TEMPORARY_HOLD' and expires_at<=now()) then raise exception 'HOLD_EXPIRED'; end if;
 select * into p from public.payments where event_id=e.id and status in ('PENDING','PROCESSING','PAID','REFUND_PENDING','REFUNDED') order by created_at desc limit 1;
 if found then
  if coalesce(p.provider,'manual')<>_provider then raise exception 'ACTIVE_PAYMENT_EXISTS'; end if;
  return p;
 end if;
 insert into public.payments(event_id,amount_idr,currency,method,provider,idempotency_key,expires_at)
 values(e.id,500000,'IDR',case when _provider='manual' then 'MANUAL_TRANSFER'::public.payment_method else 'GATEWAY'::public.payment_method end,_provider,gen_random_uuid()::text,coalesce((select min(expires_at) from public.event_date_locks where event_id=e.id),now()+interval '24 hours')) returning * into p;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'DEPOSIT_CREATED','payment',p.id,jsonb_build_object('event_id',e.id,'provider',_provider,'amount_idr',500000));
 return p;
end $$;
revoke all on function public.begin_deposit(uuid,text) from public,anon;
grant execute on function public.begin_deposit(uuid,text) to authenticated;

create or replace function public.attach_deposit_checkout(_payment_id uuid,_reference text,_url text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'UNAUTHORIZED'; end if;
 if length(_reference) not between 1 and 200 or length(_url)>2000 or _url not like 'https://%' then raise exception 'INVALID_CHECKOUT'; end if;
 update public.payments set provider_reference=_reference,checkout_url=_url where id=_payment_id and method='GATEWAY' and status='PENDING' and (provider_reference is null or provider_reference=_reference);
 if not found then raise exception 'INVALID_PAYMENT'; end if;
end $$;
revoke all on function public.attach_deposit_checkout(uuid,text,text) from public,anon,authenticated;
grant execute on function public.attach_deposit_checkout(uuid,text,text) to service_role;

create or replace function public.submit_transfer_proof(_payment_id uuid,_path text) returns void language plpgsql security definer set search_path='' as $$
declare p public.payments; e public.events;
begin
 select ev.* into e from public.events ev join public.payments pay on pay.event_id=ev.id join public.organizers o on o.id=ev.organizer_id where pay.id=_payment_id and o.owner_id=auth.uid() for update of ev;
 if not found then raise exception 'UNAUTHORIZED'; end if;
 select * into p from public.payments where id=_payment_id for update;
 if p.method<>'MANUAL_TRANSFER' or p.status<>'PENDING' or e.status<>'PENDING_PAYMENT' then raise exception 'INVALID_STATUS'; end if;
 if _path not like e.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='payment-proofs' and name=_path) then raise exception 'INVALID_PROOF'; end if;
 update public.payments set proof_path=_path,status='PROCESSING' where id=p.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'TRANSFER_PROOF_SUBMITTED','payment',p.id,jsonb_build_object('event_id',e.id));
end $$;
revoke all on function public.submit_transfer_proof(uuid,text) from public,anon;
grant execute on function public.submit_transfer_proof(uuid,text) to authenticated;

-- Internal settlement: execute permissions withheld from all API roles.
create or replace function public.settle_deposit_internal(_payment_id uuid,_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.payments; e public.events; d date; n integer; conflict boolean:=false; owner uuid;
begin
 select ev.* into e from public.events ev join public.payments pay on pay.event_id=ev.id where pay.id=_payment_id for update of ev;
 if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
 select * into p from public.payments where id=_payment_id for update;
 if p.amount_idr<>500000 or p.currency<>'IDR' then raise exception 'AMOUNT_MISMATCH'; end if;
 if p.verified_at is not null then return jsonb_build_object('status',p.status,'duplicate',true); end if;
 perform pg_advisory_xact_lock(hashtextextended(e.region_id::text,0));
 if e.status<>'PENDING_PAYMENT' or exists(select 1 from public.payments where event_id=e.id and id<>p.id and verified_at is not null) then conflict:=true;
 else
  begin
   d:=e.start_date;
   while d<=e.end_date loop
    insert into public.event_date_locks(region_id,event_date,event_id,lock_type,expires_at) values(e.region_id,d,e.id,'PAYMENT_VERIFIED',null)
    on conflict(region_id,event_date) do update set lock_type='PAYMENT_VERIFIED',expires_at=null where public.event_date_locks.event_id=e.id;
    get diagnostics n=row_count;
    if n<>1 then raise exception 'DATE_TAKEN'; end if;
    d:=d+1;
   end loop;
  exception when raise_exception then
   if sqlerrm<>'DATE_TAKEN' then raise; end if;
   conflict:=true;
  end;
 end if;
 update public.payments set status=case when conflict then 'REFUND_PENDING'::public.payment_status else 'PAID'::public.payment_status end,verified_by=_actor,verified_at=now() where id=p.id;
 if conflict then
  insert into public.refunds(payment_id,amount_idr,reason,initiated_by) values(p.id,500000,'Deposit terverifikasi tetapi tanggal tidak dapat diklaim; rekonsiliasi diperlukan',_actor);
  -- Never release a different paid deposit's reservation.
  delete from public.event_date_locks where event_id=e.id and lock_type='TEMPORARY_HOLD';
 else
  update public.events set status='PENDING_ADMIN' where id=e.id;
  insert into public.event_status_history(event_id,from_status,to_status,actor_id,reason) values(e.id,e.status,'PENDING_ADMIN',_actor,'Deposit terverifikasi dan seluruh tanggal dikunci');
 end if;
 select owner_id into owner from public.organizers where id=e.organizer_id;
 insert into public.notifications(user_id,title,message) values(owner,case when conflict then 'Deposit perlu rekonsiliasi' else 'Deposit terverifikasi' end,case when conflict then 'Tanggal tidak dapat diklaim. Pengembalian dana menunggu finance.' else 'Proposal '||e.event_code||' menunggu tinjauan admin.' end);
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(_actor,case when conflict then 'DEPOSIT_RECONCILIATION_REQUIRED' else 'DEPOSIT_VERIFIED' end,'payment',p.id,jsonb_build_object('event_id',e.id,'amount_idr',500000));
 return jsonb_build_object('status',case when conflict then 'REFUND_PENDING' else 'PAID' end,'duplicate',false);
end $$;
revoke all on function public.settle_deposit_internal(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.review_manual_deposit(_payment_id uuid,_approve boolean,_reason text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.payments;
begin
 if auth.uid() is null or not (public.has_role(auth.uid(),'finance') or public.is_super_admin()) then raise exception 'UNAUTHORIZED'; end if;
 perform 1 from public.events ev join public.payments pay on pay.event_id=ev.id where pay.id=_payment_id for update of ev;
 select * into p from public.payments where id=_payment_id for update;
 if not found or p.method<>'MANUAL_TRANSFER' then raise exception 'PAYMENT_NOT_FOUND'; end if;
 if _approve and p.verified_at is not null then return jsonb_build_object('status',p.status,'duplicate',true); end if;
 if p.status<>'PROCESSING' or p.proof_path is null then raise exception 'INVALID_STATUS'; end if;
 if _approve then return public.settle_deposit_internal(p.id,auth.uid()); end if;
 if length(trim(_reason)) not between 3 and 1000 then raise exception 'REASON_REQUIRED'; end if;
 update public.payments set status='FAILED' where id=p.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'TRANSFER_REJECTED','payment',p.id,jsonb_build_object('reason',_reason));
 return jsonb_build_object('status','FAILED');
end $$;
revoke all on function public.review_manual_deposit(uuid,boolean,text) from public,anon;
grant execute on function public.review_manual_deposit(uuid,boolean,text) to authenticated;

create or replace function public.process_gateway_deposit(_payment_id uuid,_provider text,_reference text,_event_key text,_amount integer,_currency text,_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.payments; wid uuid; result jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'UNAUTHORIZED'; end if;
 if length(_event_key) not between 1 and 250 or _status not in ('PAID','PROCESSING','FAILED','EXPIRED') then raise exception 'INVALID_CALLBACK'; end if;
 perform 1 from public.events ev join public.payments pay on pay.event_id=ev.id where pay.id=_payment_id for update of ev;
 select * into p from public.payments where id=_payment_id for update;
 if not found or p.method<>'GATEWAY' or p.provider<>_provider or p.environment<>'sandbox' or p.provider_reference is distinct from _reference then raise exception 'PAYMENT_MISMATCH'; end if;
 if _amount<>500000 or p.amount_idr<>_amount or _currency<>'IDR' then raise exception 'AMOUNT_MISMATCH'; end if;
 insert into public.payment_webhook_events(provider,provider_event_id,processing_status) values(_provider,_event_key,'PROCESSING') on conflict(provider,provider_event_id) do nothing returning id into wid;
 if wid is null then return jsonb_build_object('duplicate',true,'status',p.status); end if;
 if _status='PAID' then result:=public.settle_deposit_internal(p.id,null);
 elsif p.verified_at is null and p.status not in ('FAILED','EXPIRED') then
  update public.payments set status=_status::public.payment_status where id=p.id;
  result:=jsonb_build_object('status',_status);
 else result:=jsonb_build_object('status',p.status); end if;
 update public.payment_webhook_events set processing_status='PROCESSED',processed_at=now() where id=wid;
 return result;
end $$;
revoke all on function public.process_gateway_deposit(uuid,text,text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.process_gateway_deposit(uuid,text,text,text,integer,text,text) to service_role;

create or replace function public.release_expired_holds() returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 for e in select ev.* from public.events ev where ev.status='PENDING_PAYMENT' and exists(select 1 from public.event_date_locks l where l.event_id=ev.id and l.lock_type='TEMPORARY_HOLD' and l.expires_at<=now()) order by ev.id for update skip locked loop
  if exists(select 1 from public.payments where event_id=e.id and verified_at is not null) then continue; end if;
  delete from public.event_date_locks where event_id=e.id and lock_type='TEMPORARY_HOLD';
  update public.events set status='CANCELLED' where id=e.id;
  update public.payments set status='EXPIRED' where event_id=e.id and status='PENDING';
  insert into public.event_status_history(event_id,from_status,to_status,actor_id,reason) values(e.id,'PENDING_PAYMENT','CANCELLED',null,'Batas waktu deposit habis');
  insert into public.audit_logs(action,entity_type,entity_id,metadata) values('TEMPORARY_HOLD_EXPIRED','event',e.id,jsonb_build_object('previous_status','PENDING_PAYMENT'));
 end loop;
end $$;
revoke all on function public.release_expired_holds() from public,anon,authenticated;
grant execute on function public.release_expired_holds() to service_role;

create or replace function public.set_deposit_bank(_bank text,_account text,_beneficiary text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'UNAUTHORIZED'; end if;
 if length(trim(_bank)) not between 2 and 100 or _account !~ '^[0-9]{5,40}$' or length(trim(_beneficiary)) not between 2 and 150 then raise exception 'INVALID_BANK'; end if;
 insert into public.system_settings(key,value,updated_by) values('deposit_bank',jsonb_build_object('bank',trim(_bank),'account',_account,'beneficiary',trim(_beneficiary)),auth.uid()) on conflict(key) do update set value=excluded.value,updated_by=auth.uid(),updated_at=now();
 insert into public.audit_logs(actor_id,action,entity_type,metadata) values(auth.uid(),'DEPOSIT_BANK_UPDATED','system_settings',jsonb_build_object('key','deposit_bank'));
end $$;
revoke all on function public.set_deposit_bank(text,text,text) from public,anon;
grant execute on function public.set_deposit_bank(text,text,text) to authenticated;

create or replace function public.get_deposit_bank() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 return (select value from public.system_settings where key='deposit_bank');
end $$;
revoke all on function public.get_deposit_bank() from public,anon;
grant execute on function public.get_deposit_bank() to authenticated;