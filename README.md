# AFP Sulsel Event Hub

# MASTER IMPLEMENTATION PROMPT — AFP SULSEL EVENT MANAGEMENT SYSTEM

## 1. ROLE

Act as a senior full-stack engineer, product designer, PostgreSQL database architect, Supabase security engineer, payment integration engineer, and QA engineer.

Build a professional, production-oriented web application called:

**AFP Sulsel — Event Management & Scheduling System**

The application manages futsal event proposals, regional scheduling, organizer verification, deposits, admin approval, and refunds.

Use:
- React
- TypeScript
- A modern responsive component system
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Edge Functions
- Database migrations and automated tests

Connect to the intended AFP Sulsel Supabase project. Never silently switch backends. Do not use mock data as the final data source.

## 2. CORE BUSINESS RULE

There may be at most ONE reserved or approved futsal event per calendar date per regency/city (kabupaten/kota) in South Sulawesi.

The uniqueness scope is:

`(region_id, event_date)`

An event can last one or multiple consecutive calendar days. Every date from `start_date` through `end_date`, inclusive, must be reserved.

Example:
- Event A: Makassar, 10–12 November.
- Event B: Makassar, 11 November — REJECT due to conflict.
- Event C: Makassar, 12–13 November — REJECT due to conflict.
- Event D: another regency, 11 November — allowed if that region is available.

A frontend calendar check is not sufficient. PostgreSQL must be the final authority.

## 3. DEPOSIT AND PAYMENT RULES

The application deposit is Rp500,000 per event proposal.

Support two payment methods:
1. Payment gateway with server-side verification and signed webhook processing.
2. Manual bank transfer with private proof upload and authorized finance verification.

Keep payment status separate from event application status.

Payment statuses should include:
`PENDING`, `PROCESSING`, `PAID`, `FAILED`, `EXPIRED`, `REFUND_PENDING`, `REFUNDED`, `DISPUTED`.

Application statuses should include:
`DRAFT`, `PENDING_PAYMENT`, `PENDING_ADMIN`, `APPROVED`, `REJECTED`, `CANCELLED`, `COMPLETED`.

The optional pre-payment temporary hold must have a configurable expiration. It is not an approved event. The definitive exclusive date lock begins only after successful deposit verification and a successful atomic date-claim transaction.

The admin must not approve an event before the required payment is verified.

If a gateway payment succeeds but the date claim loses a race to another event, do not create a partial reservation. Record the payment and create a reconciliation/refund task according to the published policy.

Never trust a browser success redirect as proof of payment. Verify gateway transactions on the server, validate webhook signatures, and process duplicate webhook events idempotently.

For manual transfer, record who verified the payment, when it was verified, the amount, transaction reference, and decision.

## 4. DATABASE SCHEMA

Create reviewed SQL migrations for these tables with UUID primary keys, foreign keys, appropriate indexes, timestamps, constraints, and RLS:

### profiles
- id references auth.users
- full_name
- phone
- role: organizer, admin_event, finance, super_admin
- is_active
- created_at
- updated_at

### organizers
- id
- owner_id
- organization_name
- legal_id
- contact_person
- contact_phone
- verification_status
- created_at
- updated_at

### regions
- id
- name
- region_type
- province_code
- is_active
- created_at

Populate production region records only from a verified official administrative dataset for South Sulawesi. Do not fabricate real event or payment records.

### events
- id
- event_code, unique and generated server-side
- organizer_id
- region_id
- name
- description
- start_date
- end_date
- venue
- event_type
- participant_category
- estimated_participants
- status
- submitted_at
- reviewed_by
- reviewed_at
- rejection_reason
- created_at
- updated_at

Enforce start_date <= end_date.

### event_date_locks
- id
- region_id
- event_date
- event_id
- lock_type: TEMPORARY_HOLD, PAYMENT_VERIFIED, APPROVED
- expires_at, nullable
- created_at
- updated_at

Create a UNIQUE constraint on `(region_id, event_date)`.

A date lock must reference its event. Use foreign keys and appropriate delete restrictions to preserve financial and audit history.

### payments
- id
- event_id
- amount_idr
- currency
- method: GATEWAY or MANUAL_TRANSFER
- status
- provider
- provider_reference
- idempotency_key
- verified_by
- verified_at
- created_at
- updated_at

Use integer rupiah amounts. The required deposit is 500000 IDR. Validate the amount on the server.

### payment_webhook_events
- id
- provider
- provider_event_id
- received_at
- processing_status
- processed_at
- error_summary

Enforce uniqueness on `(provider, provider_event_id)`.

### refunds
- id
- payment_id
- amount_idr
- reason
- status
- provider_reference
- initiated_by
- processed_at
- created_at
- updated_at

### event_documents
- id
- event_id
- document_type
- storage_path
- verification_status
- reviewed_by
- reviewed_at
- created_at

### event_status_history
- id
- event_id
- from_status
- to_status
- actor_id
- reason
- created_at

### audit_logs
- id
- actor_id
- action
- entity_type
- entity_id
- metadata
- created_at

### notifications
- id
- user_id
- title
- message
- read_at
- created_at

Add appropriate indexes for calendar queries, payment reconciliation, event status, organizer lookups, and audit history.

## 5. CRITICAL DATABASE TRANSACTIONS

Implement secure database functions for:
- Creating and submitting event applications.
- Claiming every date in a proposed event range atomically.
- Verifying a manual payment.
- Processing a verified gateway payment.
- Approving an event.
- Rejecting an event and releasing its date locks.
- Cancelling an event under the authorized policy.
- Marking an event completed.
- Creating and processing a refund record.
- Expiring temporary holds.

The date-claim function must:
1. Validate the authenticated caller and permissions.
2. Validate the event, region, and date range.
3. Generate every calendar date from start_date to end_date, inclusive.
4. Acquire the required transaction-level locks or use atomic inserts protected by the unique constraint.
5. Claim every date in one database transaction.
6. Roll back the entire transaction if any date is already claimed.
7. Never leave partial date locks.
8. Update the event status and relevant history consistently.
9. Return a structured success or conflict result.

Do not implement the critical date-claim logic as a sequence of independent browser requests.

Use database transactions, appropriate locking, unique constraints, and safe retry behavior to handle concurrent submissions.

Expired holds must be released through a trusted server-side process. A background job or scheduled function must not release a lock belonging to an active, paid, or approved event.

When rejecting an application, release locks and update event status/history in a consistent transaction. Keep financial records intact. Refund execution must be handled separately and tracked to completion.

## 6. ROLE-BASED ACCESS CONTROL

Organizer:
- Manage their own profile and organization.
- Create proposals and upload required documents.
- See only their own private applications, payments, and refund records.
- Pay the deposit and track application status.
- Cannot set their own application to paid, approved, rejected, or refunded.
- Cannot modify a submitted date range without a controlled resubmission workflow.

Event Admin:
- Review applications and documents.
- Approve or reject applications.
- Cannot arbitrarily edit payment verification records.

Finance:
- Review manual transfer evidence.
- Verify manual payments.
- Manage refund requests and transaction reconciliation.
- Cannot approve an event unless explicitly granted a separate role.

Super Admin:
- Manage authorized users, roles, regions, system settings, and audit access.
- Use privileged actions only through secure server-side authorization.

Public visitor:
- View only approved public event details and permitted calendar availability.
- Never see private payment information, organizer identity documents, private notes, or unreleased applications.

Do not trust client-side role values. Enforce authorization using server-side checks and RLS.

## 7. ROW LEVEL SECURITY AND STORAGE

Enable RLS on every exposed table.

Create least-privilege policies:
- Organizers can access their own authorized records.
- Admin and finance access is limited by role and function.
- Public access is restricted to explicitly public, approved event data.
- No anonymous access to private payment or identity documents.
- Sensitive updates must go through protected database functions or Edge Functions.

Use private Supabase Storage buckets for transfer receipts and organizer documents. Validate file size, MIME type, and permitted file extensions. Use short-lived signed URLs for authorized access.

Never expose a Supabase service-role key, payment secret key, bank credentials, or webhook signing secret in frontend code, public environment variables, logs, or browser responses.

## 8. PAYMENT GATEWAY

Build a provider adapter rather than hardcoding an unconfirmed provider.

Ask the project owner which Indonesian payment gateway will be used before enabling live transactions.

Implement:
- Server-side payment session creation.
- Server-side transaction verification.
- Webhook signature verification.
- Duplicate webhook protection.
- Amount and currency validation.
- Payment expiration.
- Failed and pending states.
- Payment reconciliation.
- Refund initiation and status tracking.
- Clear sandbox versus production configuration.

Store provider credentials as backend secrets.

If credentials are not yet supplied, build a clearly labeled sandbox or configuration-pending workflow. Do not simulate a successful live payment.

For manual transfer, show administrator-configured bank details. Do not invent a bank account number or beneficiary.

## 9. ADMIN APPLICATION

Create a polished administrative dashboard with:
- Total applications.
- Awaiting payment.
- Awaiting admin review.
- Approved events.
- Rejected applications.
- Payments awaiting manual verification.
- Refunds pending.
- Calendar conflict alerts.

Admin navigation:
1. Dashboard
2. Event Calendar
3. Applications
4. Payment Verification
5. Refund Management
6. Organizers
7. Regions
8. Reports
9. User & Role Management
10. Audit Logs
11. System Settings

Application detail page:
- Event information and date range.
- Region and venue.
- Organizer profile and verification status.
- Document viewer.
- Payment status and transaction reference.
- Full status history.
- Approve button.
- Reject button requiring a reason.
- Cancel or refund controls only when policy permits.

Use confirmation dialogs for sensitive actions and show actionable errors.

## 10. ORGANIZER PORTAL

Build:
- Registration and login.
- Organizer profile and organization verification.
- Personal dashboard.
- New event proposal wizard.
- Region selector.
- Start and end date selection.
- Availability calendar.
- Venue and event details.
- Required document upload.
- Deposit checkout.
- Gateway payment status.
- Manual transfer instructions and receipt upload.
- Application status tracking.
- Notifications and event history.

The calendar must show unavailable dates and explain conflicts without exposing private data.

Revalidate date availability on submission and during the final atomic date-claim transaction. If dates become unavailable, show a clear conflict message and require the organizer to select another date.

## 11. DESIGN SYSTEM

Build a premium, official sports administration interface.

Visual direction:
- Navy blue primary color.
- White and light neutral surfaces.
- Restrained gold accents.
- Clean typography.
- Consistent spacing.
- Professional cards, tables, forms, badges, and calendar views.
- Responsive layouts for desktop, tablet, and mobile.
- Accessible contrast and keyboard navigation.

Use Indonesian as the primary UI language.

Display currency as Indonesian rupiah, for example `Rp500.000`.

Use Indonesian date formatting and the `Asia/Makassar` timezone for application display and operational timestamps.

Include loading states, empty states, permission errors, network errors, success notifications, and clear conflict messages.

Do not use fake statistics, fabricated payment transactions, or simulated live event data in production.

## 12. REPORTING AND AUDIT

Create filters by region, event date, event status, organizer, and payment status.

Support CSV export for authorized users.

Record every important action:
- Application submitted.
- Payment initiated and verified.
- Manual payment approved or rejected.
- Date locks created or released.
- Application approved or rejected.
- Refund requested and processed.
- Admin role changes.
- System configuration changes.

Audit entries must be append-only through normal application workflows. Do not let organizers modify audit records.

## 13. AUTOMATED TESTS — REQUIRED

Create tests for at least these scenarios:

1. Two different events in the same region and on the same date: only one can claim the date.
2. Two simultaneous submissions for overlapping date ranges: only one transaction succeeds.
3. Multi-day event: every inclusive date is locked.
4. Adjacent, non-overlapping date ranges: both are allowed.
5. Same date in different regions: both are allowed.
6. A conflict on the last date rolls back every inserted lock.
7. A payment webhook received twice is processed only once.
8. An invalid webhook signature cannot mark a payment paid.
9. A payment amount mismatch cannot verify the deposit.
10. An organizer cannot approve their own application.
11. An organizer cannot read another organizer's private documents or payments.
12. A finance user cannot approve an event without the appropriate role.
13. An unpaid or expired application cannot retain an expired temporary hold.
14. A paid application awaiting admin review retains its locks.
15. Rejection releases the appropriate locks without deleting payment history.
16. A completed event retains its historical records.
17. A failed refund remains visible for reconciliation.
18. Unauthorized users cannot access privileged functions.
19. A browser redirect alone cannot verify payment.
20. Date calculations work correctly across month-end and year-end boundaries.

Use a real test database or isolated test schema. Do not rely exclusively on UI mock tests.

## 14. IMPLEMENTATION SEQUENCE

Build in controlled phases:

Phase 1: Project setup, Supabase connection, authentication, roles, schema, migrations, and RLS.

Phase 2: Regions, organizer profiles, event proposal form, availability calendar, and atomic date locking.

Phase 3: Deposit payment abstraction, gateway webhook handling, manual transfer verification, and reconciliation.

Phase 4: Admin review, approval/rejection, notifications, refund workflow, and audit history.

Phase 5: Reporting, responsive polish, automated tests, security review, and deployment preparation.

After each phase:
- Summarize the files and database objects changed.
- Show migration and function names.
- Run the relevant tests.
- Identify remaining configuration requirements.
- Do not claim that a feature works until it has been tested.

## 15. FINAL ACCEPTANCE CRITERIA

The application is not ready for production until:
- Real Supabase persistence is active.
- All roles and RLS policies are tested.
- The unique date-lock constraint is verified in PostgreSQL.
- Concurrent date claims are tested.
- Both payment methods work under their configured conditions.
- Payment webhooks are verified and idempotent.
- Approval and rejection update locks correctly.
- Refunds can be reconciled.
- Private documents are protected.
- Audit logs are available to authorized administrators.
- No critical workflow depends on mock data.

Start with Phase 1. Inspect the connected project before making changes. Produce reviewed database migrations and security policies before building the payment workflow. Ask for approval before applying destructive schema changes or enabling live payments.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3ce008b6-0153-443e-b7ae-fd6a4f126faf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
