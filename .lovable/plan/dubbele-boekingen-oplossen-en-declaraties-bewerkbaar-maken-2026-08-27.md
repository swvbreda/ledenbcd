# Dubbele boekingen oplossen en declaraties bewerkbaar maken

## Wat ik in de data heb gevonden

- Dezelfde betaling staat vaak in drie bronnen (Ponto-bankkoppeling, oude bankimport, Informer/handmatige boeking). Binnen één begrotingspost worden die al ontdubbeld.
- **De ontdubbeling werkt alleen per begrotingspost.** Staat dezelfde betaling op twee verschillende posten, dan telt hij twee keer mee. Concreet gevonden in 2026, o.a.:
  - Beckers Smeets Entjes Advocaten € 3.327,50 (24-02) — op twee posten
  - 033 Horeca € 3.000,00 (20-01) — op twee posten
  - Notulen Software € 2.382,49 (14-05) — op twee posten
  - Het Strategiebureau € 262,36 (10-02) — twee handmatige boekingen op twee posten
  - BFA van Nierop € 210,00 (25-02) — op twee posten
- Bankregels (Ponto/import) hebben **geen verwijder- of ontkoppelknop** in de uitgavenlijst; alleen handmatige boekingen kun je weghalen. Daardoor kun je een dubbeling niet zelf corrigeren.
- Declaraties: er is **geen bewerkfunctie** en verwijderen/goedkeuren is alleen zichtbaar voor beheerders. In de database mag ook alleen een beheerder wijzigen of verwijderen — een indiener kan zijn eigen net ingediende declaratie dus niet meer aanpassen.

## Wat ik ga doen

### 1. Dubbeltelling over posten heen stoppen
De ontdubbeling gaat over de hele begroting in plaats van per post. Herkent het systeem dezelfde betaling (zelfde bedrag, zelfde tegenpartij, datum dicht bij elkaar of hetzelfde factuurnummer), dan telt hij nog maar één keer mee — ook als de kopieën op verschillende posten staan. Bankkoppeling wint van handmatige boeking; bij twee bankregels wint de live bankkoppeling.

### 2. Zelf kunnen corrigeren
In de uitgavenlijst van een post krijgt elke regel — óók een bankregel — acties:
- **Verplaatsen naar andere post** (dossier/post wijzigen);
- **Loskoppelen van deze post** voor bankregels (de banktransactie blijft bestaan, telt alleen niet meer mee in de begroting);
- **Verwijderen** blijft voor handmatige/Informer-boekingen.

Bij een regel die als dubbeling is herkend, staat een korte melding "samengevoegd met bankregel" met de mogelijkheid om dat terug te draaien wanneer het tóch twee losse betalingen zijn.

### 3. Eenmalige opschoning
De gevonden gevallen die nu op twee posten staan, worden nagelopen en op één post gezet, zodat de begroting direct klopt.

### 4. Declaraties bewerken en intrekken
- **Bewerken**: een declaratieregel klapt open met dezelfde velden als het invoerformulier (naam, soort, omschrijving, traject, km, datum, rekening). Bedrag wordt bij reiskosten opnieuw berekend.
- **Verwijderen/intrekken**: de indiener kan zijn eigen declaratie wijzigen en verwijderen zolang die nog niet is goedgekeurd of uitbetaald. Beheerders houden volledige rechten.
- Toegangsregels in de database worden hierop aangepast (eigen declaratie, status nog in afwachting).

## Technisch

- `src/hooks/useBudget.ts`: ontdubbeling verplaatsen van per-`line_item_id` naar globaal over alle bronnen; sleutel wordt bedrag + genormaliseerde tegenpartij + datumvenster, met factuurnummer als sterkere match (via bestaande helpers in `src/lib/ledgerDedupe.ts`). De "bank is leidend"-fallback per post blijft, maar krijgt eerst de globale ontdubbeling.
- `ExpenseDialog.tsx`: acties per regel uitbreiden (verplaatsen, loskoppelen, verwijderen); nieuwe mutaties in `useBudget.ts` die `ponto_transactions.budget_line_item_id` / `bank_transactions.line_item_id` op `null` of een andere post zetten.
- Nieuwe mutatie `update` in `src/hooks/useInternalDeclarations.ts` + bewerkformulier in `InternalDeclarationsView.tsx`; knoppen zichtbaar voor `isAdmin` of eigen `submitted_by` met status `pending`.
- Migratie: RLS-policies op `internal_declarations` voor eigen wijzigen/verwijderen bij status `pending`.
- Data-opschoning via SQL voor de betalingen die nu op twee posten staan.
