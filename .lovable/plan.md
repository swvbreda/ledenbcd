# Registergegevens in de locatiekaarten

De aparte lijst "Gekoppelde coffeeshops (register)" is al uit het ledenprofiel gehaald en er staat nu een registerblok in elke locatiekaart. Toch zie je de gegevens nog los: van de 135 bevestigde koppelingen hebben er maar 4 een vestigingssleutel (`location_key`). Bij lid #21 (Hunters) is die sleutel bij alle 6 koppelingen leeg, dus alle registershops belanden in de restlijst "Alleen in register" onder de locaties in plaats van in de juiste kaart.

## Wat er gebeurt

1. **Koppelingen alsnog aan een vestiging hangen (eenmalige opschoning)**
   Bestaande bevestigde koppelingen zonder vestigingssleutel worden gekoppeld aan de locatie van het lid, in deze volgorde:
   - gelijke postcode + huisnummer
   - gelijke postcode
   - gelijk straatadres + plaats
   - als er precies één locatie in dezelfde plaats/gemeente staat: die locatie

   Blijft er twijfel (meerdere kandidaten in dezelfde plaats), dan blijft de koppeling zonder vestiging staan en blijft hij zichtbaar als losse kaart om handmatig toe te wijzen.

2. **Weergave met terugvaloptie**
   De locatiekaart zoekt eerst op vestigingssleutel en valt daarna terug op adres/postcode/plaats, zodat registergegevens ook zichtbaar zijn als de sleutel (nog) ontbreekt of de naamgeving afwijkt ("Hunter's Filiaal" vs "Hunters Amsterdam Centrum").

3. **Handmatig toewijzen**
   Bij een kaart "Alleen in register" komt een keuzemenu om die registershop aan een van de locaties van het lid te hangen; dat slaat de vestigingssleutel op zodat het daarna vanzelf goed staat.

4. **Nieuwe koppelingen**
   De registersync vult voortaan altijd een vestigingssleutel bij een bevestigde koppeling, met dezelfde adresregels, zodat dit gat niet opnieuw ontstaat.

## Technisch

- Datamigratie/`run_sql` op `coffeeshop_member_links`: `location_key` vullen op basis van `coffeeshop_register` (postcode, huisnummer, straat, plaats) versus `members_data.data->'locaties'`, met dezelfde normalisatie als `locationKey()` in `src/components/register/RegisterCoverageCard.tsx`.
- `src/pages/MemberDetail.tsx`: matcher uitbreiden met adres-/postcodefallback en handmatige toewijzing op de restkaarten.
- `src/hooks/useCoffeeshopRegister.ts`: mutatie om `location_key` van een bestaande koppeling bij te werken.
- `supabase/functions/sync-coffeeshopregister/index.ts`: `location_key` verplicht meeschrijven bij auto-bevestigde matches.
