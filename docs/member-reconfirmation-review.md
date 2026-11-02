# Membership reconfirmation — 2 November 2026

## Prepared, not sent
- Admin-only campaign panel in `/email-templates`, with one recipient per action and a full fixed-text preview before the final send button. No bulk action, scheduler or send-on-load.
- Exact campaign `contributie-2026-11` and member IDs `10,25,34,75,78,79,91,99,107,110,114`; excluded names also checked server-side.
- Existing sender `send-transactional-email` extended and deployed successfully. Existing unrelated templates and mail branches unchanged.
- Fixed From `noreply@leden.coffeeshopbond.nl`, reply-to `info@coffeeshopbond.nl`, secretary-only signature and user-approved Dutch text.
- Recipients derive from current `members_data` merged with existing `member_edits`; top-level contact email/name are used, never client-supplied recipient or invoice values. Missing/invalid/inactive/revoked-contact/excluded recipients fail closed. The admin preview shows the resolved address before sending.
- Private request token generated only inside the sender; only the hash is saved, atomically with the permanent claim before any provider request. Stable provider idempotency key `membership-reconfirmation:<request UUID>`.
- Permanent database claim prevents concurrent/repeated sends. Interrupted/uncertain attempts are never retried and show as uncertain after two minutes. Failed and suppressed attempts also require review, not an automatic retry.
- Suppressions and used unsubscribe tokens checked before claiming and again before sending; normal unsubscribe footer retained.
- Provider HTTP success plus an ID required before `sent_at`, 30-day deadline, existing mail log and member note are committed together. Failed persistence never reports success; permanent claim remains for review.
- Existing public confirmation remains capability-scoped. Unsent links are rejected; opening a valid sent link only inspects it, while explicit confirmation records the answer once. No communication list, membership status, invoice or payment changes.

## Live readback
- Migration applied: `drizzle/migrations/0075_member_reconfirmation_individual_send.sql`.
- All 11 requests: `send_status=unsent`, `sent_at=NULL`, no claim. Campaign mail-log count: **0**.
- Existing request table RLS enabled; anonymous/authenticated table reads denied; authenticated claim execution denied. Claim and finish are service-only; sender independently validates an authenticated admin through caller-scoped `has_role`.
- Existing provider configuration names `RESEND_API_KEY` and `LOVABLE_API_KEY` present; no values inspected/output and no delivery test performed.
- Deployed sender source SHA-256: `cfdff778b5f423d7dc19f382c2820601514bd444c29db9673a32201a066c5982`.
- Live negative request without authorization rejected with HTTP 401 before any send.

## Checks
- 16 policy/worker tests: `bunx vitest run src/lib/memberReconfirmationCampaign.test.ts`.
- 7 UI interaction tests: `bunx vitest run -c vitest.components.config.ts src/components/__tests__/MemberReconfirmationCampaign.render.tsx`.
- 2 Deno edge tests, also passed through the hosted edge-test tool.
- Isolated PostgreSQL fixture: `bash supabase/tests/member_reconfirmation_run.sh`; eight concurrent claims yield exactly one pending mail log; exceptions assert scope, admin denial, suppression, stale claim rejection, acceptance proof, exact 30-day deadline, explicit-click confirmation, replay, permanent unknown claim and access grants.
- Deno type checking of the complete sender passed with its React-18 compiler settings and isolated dependency resolution. Initial unconfigured Deno invocation had dependency/type mismatches, not source failures.
- Latest automatic portal build: OK; diff whitespace check passed. No separate manual app build/typecheck run.
- Browser: invalid public link rejected, signed-out `/email-templates` redirects to `/login`.

## Limitations / handover
- No signed-in admin browser session available: self-session mint found no matching requesting account; explicit Simone session mint required unavailable approval. Admin recipient/preview UI tested using isolated mocked component interactions, **not** through a real authenticated browser session.
- No email sent, therefore provider acceptance/delivery not exercised live; tests use fixtures/mocks only.
- Portal frontend has **not** been published. Panel is prepared in preview; the existing sender and additive database changes are live. Inspect the preview while signed in before individually triggering any approved mail.

## Main files
- `src/components/MemberReconfirmationCampaign.tsx`
- `src/lib/memberReconfirmationCampaign.functions.ts`
- `src/pages/EmailTemplatesPage.tsx`
- `supabase/functions/send-transactional-email/memberReconfirmation.ts` and existing `index.ts`
- `supabase/functions/_shared/memberReconfirmationPolicy.ts`
- `supabase/functions/_shared/transactional-email-templates/membership-reconfirmation.tsx` and registry
- Existing `src/lib/memberReconfirmation.functions.ts` unchanged; public page only gains required metadata.