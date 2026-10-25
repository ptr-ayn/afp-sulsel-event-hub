alter table public.payments add column checkout_claimed_at timestamptz;
create function public.claim_deposit_checkout(_payment_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'UNAUTHORIZED'; end if;
 update public.payments set checkout_claimed_at=now() where id=_payment_id and status='PENDING' and method='GATEWAY' and environment='sandbox' and checkout_url is null and checkout_claimed_at is null;
 return found;
end $$;
revoke all on function public.claim_deposit_checkout(uuid) from public,anon,authenticated;
grant execute on function public.claim_deposit_checkout(uuid) to service_role;
create or replace function app_private.submit_transfer_proof(_payment_id uuid,_path text) returns void language plpgsql security definer set search_path='' as $$
declare p public.payments; e public.events;
begin
 select ev.* into e from public.events ev join public.payments pay on pay.event_id=ev.id join public.organizers o on o.id=ev.organizer_id where pay.id=_payment_id and o.owner_id=auth.uid() for update of ev;
 if not found then raise exception 'UNAUTHORIZED'; end if;
 select * into p from public.payments where id=_payment_id for update;
 if p.method<>'MANUAL_TRANSFER' or p.status<>'PENDING' or e.status<>'PENDING_PAYMENT' then raise exception 'INVALID_STATUS'; end if;
 if _path not like e.id::text||'/%' or _path !~ '\.(pdf|jpg|jpeg|png)$' or not exists(select 1 from storage.objects where bucket_id='payment-proofs' and name=_path and coalesce((metadata->>'size')::bigint,0) between 1 and 10485760 and metadata->>'mimetype' in ('application/pdf','image/jpeg','image/png')) then raise exception 'INVALID_PROOF'; end if;
 update public.payments set proof_path=_path,status='PROCESSING' where id=p.id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'TRANSFER_PROOF_SUBMITTED','payment',p.id,jsonb_build_object('event_id',e.id));
end $$;