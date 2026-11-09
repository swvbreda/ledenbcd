# Shared image access review — 9 November 2026

## Finding and intended access

The private Storage buckets `agenda-images` and `member-logos` had SELECT policies that checked only the bucket ID for the `authenticated` role. Consequently any signed-in account could directly list or read those objects, independently of its portal relationship. Both buckets were already private; the problem was the broad authenticated rule.

Shared reading is required. Making every file owner-only would break agenda illustrations and the member directory.

## Change

The migration changes only those two existing SELECT predicates.

- Agenda images remain available to admins, including a new upload before its event has been saved. Other board or linked portal readers see only images referenced by published agenda records that their existing agenda RLS permits.
- Admins and board retain logo media access. Other linked portal readers can read only the application's normal `<numeric memberId>/logo.*` shape. Unlinked, external and hired accounts do not receive direct read access through the linked-member helper.
- The existing restrictive `contact_account_active()` policy still blocks revoked accounts. Contact-photo and all write policies remain unchanged.
- The existing helper permits linked member and lead records, matching the directory's existing relationship contract. This change does not create or expand accounts, roles, memberships or helper privileges.

## Public sharing and temporary URLs

The separate, intentional public adapters for a member logo and a specific agenda share code retain their existing contracts. This is a restriction of direct private-bucket access, not a promise that intentionally shared logos become secret.

Already issued signed URLs have their original expiry. The application creates these URLs for 3,600 seconds; changing a read policy does not itself revoke an existing bearer link. Validation must evaluate a fresh permission decision rather than reuse such a URL.

## Validation

The isolated PostgreSQL test uses PGlite 0.5.16 with synthetic actors and objects, actual catalog helper definitions, real RLS, grants and `SET LOCAL ROLE`. It first reproduces the broad access before applying this exact migration, then verifies the intended allow/deny cases. All 101 checks across 12 actors passed. It never connects to a hosted database.

Run the committed verification script with PGlite installed in a temporary test directory and its `node_modules` exposed through `NODE_PATH`. No application dependency change is required.

```sh
npm install --prefix /tmp/bcd-storage-test --no-save --ignore-scripts @electric-sql/pglite@0.5.16
NODE_PATH=/tmp/bcd-storage-test/node_modules node scripts/verify-shared-storage.cjs supabase/migrations/20261109225157_shared_image_reader_scope.sql
```

Live verification completed on 9 November 2026. The two expected SELECT predicates were read back after one successful transaction. Both buckets remained private, all 49 other Storage policies were unchanged, and the eight existing objects were preserved. Required helper EXECUTE and agenda SELECT grants remained present, and Storage RLS remained enabled.

A new Lovable security scan has been requested. At this verification step it was still queued behind other project work, so a completed clean scanner result is not yet claimed. No finding was ignored or manually marked resolved.
