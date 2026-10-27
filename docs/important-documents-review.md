# Belangrijke documenten — preview review

## Canonical source and scope
- Existing authenticated `/api/leden/kennisbank` catalog, proxied to coffeeshopbond.nl, retained unchanged. No database writes, migrations, duplicate IDs, file copies, deletion, or deployment.
- Readback: 15 documents, 12 downloadable and 3 marked unavailable by the source.
- Actual subjects: Schaarse vergunningen (13, existing `dossier` metadata), Nevenproducten en verkoopregels (1, Amsterdam 2006 letter), Experiment gesloten coffeeshopketen (1, T1 analysis). Known source IDs classify the two records whose source dossier is only `dossier`; other unknown records appear as Overig.
- Existing `categorie` values (juridisch/vng/ministeries/gemeenten/kamer) describe document type/recipient, not a substantive subject, and were not relabelled in the source.
- No document upload/edit control exists for this catalog in this app. Source administration remains untouched. Jaarplan's separate secure_documents upload/edit flow is unchanged. Topic editing cannot be added to this external read-only catalog without a separate supported source-write contract; no misleading local editor was added.

## Presentation and access
- `/belangrijke-documenten` shares the existing protected dashboard, authenticated catalog and signed download-by-ID flow. Desktop/mobile share AppSidebar; menu entry immediately follows Kennisbank, with the same inhuur visibility restriction.
- Knowledge-bank iframe retained. Old hashes `documenten`, `brieven`, `brieven-voor-leden`, `brieven-en-bestanden-voor-leden` redirect to the new page; ordinary knowledge-bank hashes are unchanged. Source document IDs also serve as new page anchors.
- Alphabetical subjects, Overig last. Reliable complete ISO dates sort newest first; if any subject date is missing/invalid, that subject sorts by title. No date inferred from ID or date label.
- PDF requests still use the canonical document ID. Temporary anchor opens the authenticated URL; no URLs or file paths are persisted or made public.

## Verification
- `bunx vitest run src/lib/importantDocuments.test.ts src/lib/knowledgeBase.test.ts`: 13 passed.
- Automatic build/typecheck pipeline: build OK (2026-10-27 10:00 UTC); no manual build/typecheck invoked.
- Actual injected admin session: new page reads 15 matching canonical IDs exactly once; topic filter selects only the actual experiment document; desktop sidebar adjacency verified; old knowledge-bank document hash redirect verified.
- 390×844 mobile: no horizontal overflow, mobile menu opens and navigates to the new page. Desktop 1280×1800 and mobile screenshots inspected.
- Anonymous browser: redirected to login; catalog returns 401. No browser runtime errors. Existing upstream member authorization unchanged; no role or account modifications.
- No source editing/upload or real PDF download performed. No clean member-only test identity was supplied; admin session and anonymous denial verified, existing member service controls retained.

## Changed files
- `src/pages/KennisbankPage.tsx`
- `src/pages/BelangrijkeDocumentenPage.tsx`
- `src/routes/_dashboard/belangrijke-documenten.tsx`
- `src/components/AppSidebar.tsx`
- `src/lib/importantDocuments.ts`, `src/lib/importantDocuments.test.ts`
- `AGENTS.md`, `roadmap.md`, this review.
- Route tree updates are generated automatically.