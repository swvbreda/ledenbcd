# Kerngegevens-pagina

Een nieuwe analysepagina die inzichten afleidt uit het ledenbestand, de bankgegevens en de registerkoppelingen. Geen nieuwe data-invoer: alles wordt berekend uit wat er al is.

## Wat de pagina toont

**1. Bovenaan: kerncijfers**
- Aantal leden, aantal vestigingen, gemiddeld aantal vestigingen per lid
- Aantal gemeenten waarin leden actief zijn
- Aantal aan het register gekoppelde vestigingen

**2. Bankiert bij**
- Verdeling van banken, afgeleid uit de IBAN's van leden (bankcode in het IBAN: ING, Rabobank, ABN AMRO, SNS, ASN, RegioBank, Knab, bunq, Triodos, Van Lanschot, Revolut, buitenlands/overig)
- Staafdiagram + tabel met aantal leden en percentage per bank
- Klikbaar: opent de lijst met leden bij die bank
- Aparte teller "onbekend" voor leden zonder bekend IBAN

**3. Ondernemerschap / omvang**
- Verdeling: leden met 1 vestiging, 2, 3–5, 6+ ("multi-shop ondernemers")
- Top-lijst grootste leden op aantal vestigingen
- Aantal leden dat in meerdere gemeenten actief is

**4. Geografie**
- Top gemeenten op aantal vestigingen van leden
- Aandeel vertegenwoordigde shops per gemeente (uit de bestaande register-RPC)

**5. Historie & UBO**
- Verdeling oprichtingsjaren van vestigingen (per decennium) en lidmaatschapsduur
- Aantal vestigingen met bekende UBO en aantal unieke UBO-personen die aan meerdere shops verbonden zijn (indicatie van eigendomsconcentratie)

Elke sectie krijgt bovenaan een korte regel met de peildatum en de databron, zodat duidelijk is waar het cijfer vandaan komt.

## Technisch

- Nieuwe pagina `src/pages/KerngegevensPage.tsx`, route `/kerngegevens`, menu-item onder Statistieken; zichtbaar voor bestuur/admin (zelfde rolcheck als Coffeeshopregister).
- Nieuwe helper `src/lib/bankFromIban.ts`: IBAN → banknaam via de 4-letterige bankcode, met nette fallback.
- Berekeningen client-side op de bestaande `useMembersData()` (rawMembers) in een hook `src/hooks/useKerngegevens.ts`; locatietelling via de bestaande `locationCount.ts` zodat de aantallen exact matchen met de dashboardcijfers.
- Registerkoppelingen en vertegenwoordiging via de bestaande RPC `get_representation_stats()` en `useCoffeeshopRegister`; geen nieuwe tabellen of migraties.
- Grafieken met de al gebruikte recharts-componenten, styling volgens de huisstijl (rood accent, Archivo Black koppen, `tabular-nums`).
