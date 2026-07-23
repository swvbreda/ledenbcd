## Doel

Per lid één of meer bankrekeningen (IBAN) kunnen vastleggen, zodat toekomstige contributiebetalingen direct aan het juiste lid worden gekoppeld — zonder eerst uit historische boekingen te "leren".

## Wat er komt

1. **Nieuw veld `ibans` (lijst) op elk lid**
   - Opgeslagen in het bestaande JSONB `data`-veld van `members_data` (net als `factuurEmail` e.d.) — geen schemawijziging nodig.
   - Formaat: array van strings, bv. `["NL12RABO0123456789", "NL34INGB0987654321"]`.
   - Normalisatie bij opslaan: spaties eruit, hoofdletters, basisvalidatie (begint met 2 letters + 2 cijfers).

2. **UI in het factuurblok van `MemberEditForm`**
   - Onder Telefoon een sectie **Bankrekening(en)**.
   - Lijstje met bestaande IBAN's, elk met een verwijderknop en een "+ IBAN toevoegen" knop.
   - Tonen in `MemberDetail` naast KVK / factuur-email.
   - Ook zichtbaar/bewerkbaar in de leden-edit-request flow (dezelfde velden gaan via het bestaande `member_edits`-mechanisme mee, geen extra werk).

3. **Automatische vulling vanuit reeds gekoppelde bankboekingen**
   - Eenmalige backfill: voor elk lid met een bestaande `Contributie #<id>`-koppeling in `ponto_transactions` / `bank_transactions` de bijbehorende `counterparty_iban` toevoegen aan `data.ibans` (dedup).
   - Zo staat de IBAN-historie meteen bij de leden.

4. **Contributie-matcher gebruikt lid-IBAN's als primaire bron**
   - In `supabase/functions/ponto-sync/index.ts` (`matchContributionPayments`) de `ibanToMember`-map eerst vullen uit `members_data.data.ibans`, daarna aanvullen met wat uit historische boekingen wordt geleerd.
   - Strategie-label voor die matches blijft `iban` (paars badge in het bestaande Contributie-matches paneel).

5. **Terugkoppeling na een succesvolle match**
   - Wanneer de matcher een nieuw IBAN via factuurnummer/lidnummer/naam koppelt aan een lid, wordt die IBAN automatisch toegevoegd aan `data.ibans` van dat lid (als hij er nog niet staat). Zo groeit het bestand vanzelf.

## Technisch overzicht

- **Type**: `Member` in `src/data/types.ts` krijgt `ibans?: string[]`.
- **Form**: `src/components/MemberEditForm.tsx` — nieuwe state `ibans`, UI met add/remove, meesturen in `onSave`.
- **Weergave**: `src/pages/MemberDetail.tsx` — regel "Bankrekening(en)" in het factuur-informatieblok.
- **Backfill + IBAN-leren bij match**: uitgevoerd server-side in `ponto-sync/index.ts`. De backfill draait één keer als onderdeel van de eerstvolgende sync (idempotent, alleen aanvullen, niets overschrijven).
- **Geen migratie nodig** — alles leeft in het bestaande JSONB `data`-veld en respecteert de bestaande fetch-and-merge regel (nooit lid-data overschrijven).

## Buiten scope

- IBAN's van externe partijen (leveranciers/crediteuren) — dit gaat puur over leden voor contributie-matching.
- Validatie van het banklandnummer / mod-97 checksum: alleen basisvorm, geen strenge IBAN-validatie.
