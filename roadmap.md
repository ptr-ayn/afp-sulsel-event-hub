# Roadmap — AFP Sulsel Event Management System

Source of truth: the user's MASTER IMPLEMENTATION PROMPT (chat, 2026-10-24).
Backend: user's own Supabase project (ref cwmznvhtrulmnwyvykbn). Deposit Rp500.000, Midtrans AND Xendit behind a provider adapter, 24 South Sulawesi regions, Indonesian UI, Asia/Makassar timezone.

## Phase 1 — Setup, auth, roles, schema, RLS  ✅ (done, pending app UI)
- [x] Schema migration: 14 tables, enums, indexes, constraints (unique `(region_id, event_date)` on `event_date_locks`, `start_date <= end_date` on `events`)
- [x] Role helpers (`has_role`, `is_staff`, `is_super_admin`), RLS on every table, storage policies, audit append-only trigger, signup bootstrap trigger
- [x] Seed 24 official Kemendagri regions
- [x] Private buckets `organizer-documents`, `payment-proofs`
- [ ] Auth UI (register/login), session wiring in app — part of Phase 2 build
- [ ] First super_admin account (needs a signed-up user to promote)

## Phase 2 — Regions, organizer profiles, proposal wizard, availability calendar, atomic date locking
- [ ] Auth pages + session wiring (src/start.ts middleware, _authenticated layout)
- [ ] Organizer profile/organization verification flow
- [ ] Event proposal wizard (region selector, date range, venue, docs upload)
- [ ] Availability check server function + calendar UI
- [ ] DB function: atomic date-claim transaction (`claim_event_dates`), submit flow, temporary-hold expiry job

## Phase 3 — Deposit payments
- [ ] Payment provider adapter (Midtrans + Xendit, sandbox first; live payments need explicit approval)
- [ ] Server-side session creation + transaction verification
- [ ] Signed webhook route under `/api/public/*`, idempotent processing
- [ ] Manual transfer instructions (bank details from admin settings) + receipt upload + finance verification
- [ ] Refund/reconciliation task creation when date claim loses a race

## Phase 4 — Admin review, notifications, refunds, audit
- [ ] Admin dashboard, applications review, approve/reject with reason
- [ ] Approval/release of date locks in consistent transactions
- [ ] Notifications, refund workflow, audit history UI

## Phase 5 — Reporting, polish, tests, security review
- [ ] Reports + CSV export, responsive polish, automated DB tests (20 scenarios from the brief), security review, deployment prep
