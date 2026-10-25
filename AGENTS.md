<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture Rules

- Backend is the user's own external Supabase project (ref `cwmznvhtrulmnwyvykbn`). Never use Lovable Cloud or switch backends without asking.
- User roles live only in `public.user_roles`, checked through the security-definer helpers `public.has_role()`, `public.is_staff()`, `public.is_super_admin()`. Never store a role on `profiles` — role columns on user-editable tables are a privilege-escalation risk.
- All writes to `events` (beyond draft insert), `event_date_locks`, `payments`, `payment_webhook_events`, `refunds`, `event_status_history`, and `audit_logs` go through security-definer database functions called from TanStack server functions. Clients have no UPDATE/INSERT policies on these tables — atomic date claims, payment verification, and status transitions must not be client-trusted.
- `audit_logs` is append-only, enforced by the `audit_logs_no_mutation` trigger (blocks UPDATE and DELETE even for service_role).
- `event_code` is generated server-side from `public.event_code_seq` as `AFP-XXXXX` (column default) — never generated in the browser.
- Storage buckets `organizer-documents` and `payment-proofs` are private, 10 MB limit, paths start with the event UUID (`<event_id>/<file>`); access is owner/staff-only via storage RLS policies.
- `regions` is seeded only from the official Kemendagri dataset (24 regions of South Sulawesi, province code 73). Never fabricate events or payment records.
- App-internal server logic uses `createServerFn` / server routes under `src/routes/api`; no new Supabase Edge Functions.
- Deposit amount is Rp500.000 per proposal, stored as integer IDR; the server validates amounts, never the browser.
- Public Supabase URL + publishable key live in `src/integrations/supabase/public-config.ts` as a fallback, because `.env` is gitignored and git-based builds otherwise have no VITE_SUPABASE_* values. Secret keys never go there.
- Payment adapters and callback authentication live in server-only modules; authenticated TanStack functions authorize ordinary actions, while authenticated callbacks query provider status before service-only settlement RPCs, so redirects never verify deposits.
- Payment owner/finance security-definer implementations live in non-exposed app_private with public security-invoker wrappers; transaction-only internal settlement has no API-role execution grant, preventing bypass of payment verification.
