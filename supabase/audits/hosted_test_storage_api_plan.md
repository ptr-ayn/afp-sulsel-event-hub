# Hosted TEST Storage API Test Plan

Target project: `bvtqtvqvwbqmuewuhipc` only.

Run only with dummy accounts and dummy files after the database migration is approved and applied to TEST. Do not use production accounts, documents, or buckets.

## Fixtures

- Organizer A: ordinary `organizer` user with one owned `DRAFT` event.
- Organizer B: ordinary `organizer` user with one owned `DRAFT` event.
- Organizer A submitted event: same owner, status other than `DRAFT`.
- Staff user: `admin_event` or `super_admin` test identity.
- Dummy files: small non-sensitive PDF and text fixture created for TEST only.

## Cases

1. Organizer A uploads `organizer-documents/<event-a-id>/a.pdf` for the owned `DRAFT` event. Expect success.
2. Organizer A uploads under `<event-b-id>/a.pdf`. Expect Storage API denial.
3. Organizer A uploads under the owned submitted event UUID. Expect Storage API denial.
4. Organizer A attempts to delete an object owned by Organizer B. Expect Storage API denial.
5. Staff reads an allowed organizer document or payment proof through the Storage API. Expect success only where the corresponding policy allows it.
6. Organizer A attempts to read Organizer B's document. Expect denial or an empty result, depending on the Storage API operation.
7. An ordinary organizer attempts to read a payment proof owned by another organizer. Expect denial or an empty result.
8. After a successful dummy upload, delete the same dummy object through the Storage API as Organizer A. Expect success only while the event remains `DRAFT`.

For every case, record only HTTP status and a redacted operation identifier. Do not record access tokens, signed URLs, file contents, user email addresses, or response bodies containing private metadata.

## Preconditions

- Confirm the Dashboard header and SQL Editor project ref are `bvtqtvqvwbqmuewuhipc`.
- Confirm the TEST buckets are private and the expected Storage policies exist.
- Obtain explicit approval before performing the upload/delete operations above.
- Revoke or delete the dummy users and objects after the test through the TEST Dashboard or approved TEST-only cleanup procedure.
