# Contributieblok: leesbaar op mobiel en kloppend met de administratie

Twee problemen in het blok "Contributie & facturen" op de ledendetailpagina.

## 1. Tekst loopt door elkaar

Het blok gebruikt op elk scherm zes even brede kolommen (jaar, factuurdatum, factuurnummer, bedrag, status, betaald op). Op een telefoon is elke kolom ~60px breed, waardoor datums en bedragen over elkaar heen vallen (zoals in je screenshot).

Oplossing:
- Op mobiel per jaar één kaart met labels onder elkaar: Jaar als kop, daaronder Factuurdatum / Factuurnummer / Bedrag / Betaald op als label-waarde-regels, met de statusbadge rechtsboven.
- Vanaf tablet/desktop blijft de huidige kolomweergave, maar met kolombreedtes op maat (jaar en status smal, factuurnummer breed) in plaats van zes gelijke kolommen.
- Bedragen en datums blijven `tabular-nums`, niets breekt meer af.

## 2. Weergave klopt niet met de administratie

Wat de controle in de database liet zien:

- De getoonde "factuurdatum" is niet de factuurdatum maar het tijdstip waarop de regel is aangemaakt. Daardoor staat bij alle 116 facturen 26-03-2026, ook als de echte factuurdatum anders is.
- Factuurnummers staan op twee plekken (facturenlijst en contributieregel). Bij 14 leden verschillen ze en bij 19 leden ontbreekt het nummer op de contributieregel. Nu wordt maar één bron getoond.
- Bij 14 leden wijkt de betaaldatum op de contributieregel af van de datum van de daadwerkelijke bankbetaling (bijv. lid 3: 30-01 getoond, 04-02 betaald; lid 78: 15-01-2026 getoond, 29-12-2025 betaald).
- Bij lid 21 staat €3.000 als bedrag terwijl er €6.000 aan betalingen geboekt is (dubbele betaling).
- Bij een leeg bedrag wordt blind €3.000 getoond, ook als het werkelijke bedrag afwijkt (er zijn facturen van €1.000 en €1.500).

Aanpak:
- **Betalingen zijn leidend** voor de betaaldatum en het betaalde bedrag: de weergave toont de datum van de laatste geboekte bankbetaling en de som van de betalingen, in plaats van het losse veld op de contributieregel.
- **Facturen zijn leidend** voor factuurdatum, factuurnummer en factuurbedrag; ontbreekt de factuurregel, dan vallen we terug op de gegevens uit de contributieregel (inclusief de uit de administratie gesynchroniseerde nummers).
- Geen vaste €3.000 meer als er geen bedrag bekend is; dan een streepje.
- Bij deelbetalingen of te veel betaald een duidelijke aanvulling onder de status ("€1.000 van €3.000" / "€3.000 te veel betaald") zodat het zichtbaar is in plaats van misleidend "Betaald".
- Eenmalige opschoning van de database zodat beide plekken weer gelijk lopen: betaaldatums bijtrekken naar de werkelijke betaaldatum (14 leden), ontbrekende/afwijkende factuurnummers overnemen uit de facturenlijst (33 leden), en de dubbele betaling bij lid 21 apart aan je voorleggen voordat er iets verwijderd wordt.
- Dit geldt voor alle leden: de logica zit in de gedeelde weergave, de opschoning draait over de hele tabel.

## Technisch

- `src/pages/MemberDetail.tsx`: contributieblok herschrijven naar een `ContributionYearRow`-weergave met mobiele kaart + desktopgrid (`md:grid-cols-[auto_1fr_1.4fr_1fr_auto_1fr]`); factuurdatum uit `contribution_invoices.invoice_date` (fallback `member_contributions.invoice_date`, dan `created_at`).
- Nieuwe afgeleide data per jaar: som en max-datum uit `contribution_payments` (via een `useMemberPayments`-selectie in `src/hooks/useContributions.ts`), factuurnummer als union van beide bronnen.
- Data-opschoning via losse SQL-updates op `member_contributions` (paid_date, invoice_number, invoice_date); geen schemawijziging nodig.
