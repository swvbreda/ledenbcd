Ik zie waarom dit fout blijft: er staat helemaal geen opgeslagen bankafschrift voor 2026 in de database. Daardoor valt het scherm terug op de oude administratieve berekening uit contributies/uitgaven en toont het weer `Inkomsten €331.000,00`, `Uitgaven €303.076,83`, `Resultaat €27.923,17` in plaats van de bankwaarden uit het PDF.

Plan:

1. **Bank-PDF niet meer via AI laten bepalen voor het overzicht**
   - Voor ABN AMRO bankafschriften parse ik de PDF deterministisch op basis van de echte tabelkolommen `Datum`, `Omschrijving`, `Bedrag af`, `Bedrag bij`.
   - Daarmee worden exact de bankregels opgeslagen, inclusief:
     - beginsaldo: `€209.561,05`
     - eindsaldo: `€279.995,93`
     - afschrijvingen: `€212.390,51`
     - bijschrijvingen: `€282.825,39`
     - 200 bankregels volgens het afschrift

2. **Import-flow robuust maken**
   - Als de PDF een ABN AMRO bankafschrift is, gebruikt de import de bankparser.
   - Alleen voor oude crediteurenlijsten blijft de AI-extractie als fallback bestaan.
   - De saldocontrole wordt hard: als mutaties niet aansluiten op begin/eindsaldo, moet dat zichtbaar zijn vóór opslaan.

3. **Overzicht altijd bankwaarden laten tonen zodra een bankafschrift is opgeslagen**
   - Boven de tabel komt dan niet meer `Resultaat €27.923,17`, maar bankinformatie:
     - `Beginsaldo bank: €209.561,05`
     - `Eindsaldo bank: €279.995,93`
     - `Mutatie: €70.434,88`
   - De tabel toont bankregels met categorie `Bank`, niet de oude gecombineerde boekingen.

4. **Bestaande verkeerde staat opruimen door opnieuw importeren mogelijk te maken**
   - Bij her-upload wordt de oude bank-import voor dat jaar vervangen door de nieuwe exacte bankregels.
   - De administratieve uitgaven/contributies blijven bestaan voor koppelingen, maar zijn niet langer de bron voor het bankoverzicht.

Technisch:
- Aanpassen `supabase/functions/extract-creditors/index.ts` zodat het ABN AMRO PDF-document eerst met een deterministic parser wordt verwerkt.
- Aanpassen `src/components/budget/PdfImportDialog.tsx` zodat alle bankregels worden opgeslagen, los van welke regels geselecteerd zijn voor koppeling aan uitgaven/contributie.
- Controleren dat `useBankStatement(2026)` daarna data teruggeeft en `BoekingenOverzicht` automatisch naar de bankweergave schakelt.
- Na implementatie verifieer ik met het meegeleverde PDF dat de totalen exact overeenkomen met het bankafschrift.