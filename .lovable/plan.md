# Beveiligingscontrole (alleen lezen) — resultaat, geen wijzigingen

## Scanstatus (23:38 UTC, 9 nov 2026)
- Databasescan: opnieuw gedraaid en afgerond, 6 meldingen (3 Warning, 3 Info, **0 Critical**).
- Diepe scan (agent_security): status "unknown", geen opgeslagen meldingen. Dit is waarschijnlijk de melding "We couldn't finish the security scan". De 1 Critical + 1 Warning op jouw screenshot zijn met deze tools **niet terug te lezen**.
- MCP-scan: afgerond, 0 meldingen. Afhankelijkhedenscan: afgerond (21:41), 0 meldingen. Wiz: overgeslagen (niet gekoppeld).
- De eerdere meldingen over agenda-images en member-logos staan **niet meer** in de actieve lijst.

## Actieve meldingen
1. Warning `lov_db_rls_tautology_permissive_v1_11240cd4d82eae50` — tabel `membership_requests`, policy "Anyone can submit a request": INSERT `WITH CHECK (true)`.
2. Warning `lov_db_rls_tautology_permissive_v1_5ed9d476b56d3551` — tabel `benefit_images`, policy "Authenticated can read benefit images": SELECT `USING (true)`.
3. Warning `lov_db_rls_tautology_permissive_v1_18e65ee9b5c46858` — tabel `survey_questions`: SELECT voor elke ingelogde gebruiker zonder beperking (nieuw in deze scan).
4. Info `lov_db_storage_objects_owner_unbound_v1_4a1c70ea5e6b1807` — bucket `benefit-images`, policy "Benefit images are publicly accessible": iedereen kan bestanden opsommen.
5. Info `lov_db_storage_objects_owner_unbound_v1_c5a81138160d0e9e` — bucket `org-logos`, policy "Anyone can read org logos".
6. Info `lov_db_storage_objects_owner_unbound_v1_e89cffc93d066508` — bucket `bestuur-photos`, policy "Public can view bestuur photos".

## Notulentaak
Ongewijzigd: niets aan policies, code, data of meldingen veranderd; niets gepubliceerd.

## Volgende stap (alleen na jouw akkoord)
Geen bouwwerk voorgesteld. De diepe scan opnieuw starten vanuit het Security-scherm om de Critical-melding zichtbaar te maken.
