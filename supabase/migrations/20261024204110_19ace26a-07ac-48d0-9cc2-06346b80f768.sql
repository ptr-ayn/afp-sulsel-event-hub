alter function public.set_updated_at() set search_path = public;

revoke execute on function public.has_role(uuid, public.app_role) from anon, public;
revoke execute on function public.is_staff() from anon, public;
revoke execute on function public.is_super_admin() from anon, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

create policy "webhook_events_service_only" on public.payment_webhook_events
  for all to service_role
  using (true) with check (true);