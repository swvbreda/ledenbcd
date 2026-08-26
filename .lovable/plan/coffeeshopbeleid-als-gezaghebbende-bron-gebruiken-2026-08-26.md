# Coffeeshopbeleid als gezaghebbende bron gebruiken

## Vastgestelde oorzaak

Het ledenproject haalt nu alleen de losse vergunningregels uit Coffeeshopbeleid op. De synchronisatie neemt de daar vastgelegde relaties, eigendomsketen en UBO-gegevens niet mee wanneer het beveiligde exportpad ontbreekt of niet beschikbaar is.

Daardoor ontstaan twee problemen:

- een zichtbare relatie in Coffeeshopbeleid kan hier als “niet gekoppeld” verschijnen;
- **Eigendom & UBO** toont hier 0, terwijl Coffeeshopbeleid wel eigendoms- en koppelgegevens bevat.

In de lokale database zijn momenteel 138 registershops aan leden gekoppeld, maar staan 0 UBO-regels. De kerngegevenspagina leest bovendien alleen UBO's die al in de locatie-JSON van het lid staan en niet rechtstreeks de registerrelaties.

## Aanpak

1. **Niets verwijderen bij Green House**
   - Green House United en Greenhouse Lounge blijven staan totdat de bronrelatie en historie uit Coffeeshopbeleid volledig zijn overgenomen.
   - Geen vertegenwoordigingsaantal handmatig verlagen.

2. **Bronexport compleet maken**
   - In Coffeeshopbeleid een beveiligde export gebruiken voor vergunning, actuele naam/adresgegevens, KvK/vestiging, exploitant/vergunninghouder, eigendomsketen en UBO.
   - Ook expliciete relaties en historische/alternatieve namen meesturen, zodat twee vermeldingen op hetzelfde adres niet automatisch als dubbel worden behandeld.

3. **Synchronisatie in het ledenproject corrigeren**
   - De beveiligde bronexport leidend maken en duidelijk signaleren wanneer alleen de beperkte openbare fallback actief is.
   - UBO/eigendom per registervestiging opslaan en oude brongegevens veilig bijwerken zonder factuurgegevens of handmatige ledengegevens te overschrijven.
   - Bestaande bevestigde koppelingen behouden; alleen brongegevens verrijken.

4. **Kerngegevens op registerdata baseren**
   - Eigendom & UBO berekenen uit gekoppelde registervestigingen plus de gesynchroniseerde eigendomsketen.
   - Namen normaliseren voor de telling, maar originele namen tonen.
   - Per persoon doorklikbaar tonen aan welke registervestigingen en leden die persoon is verbonden.

5. **Green House verifiëren**
   - De bronrecords en relaties voor United/Lounge naast elkaar tonen: actuele naam, eventuele voormalige naam, adres/postcode, vergunning en eigendom.
   - Alleen als Coffeeshopbeleid zelf aangeeft dat het één actueel dossier met een alias/historische naam is, de ledenlocaties gecontroleerd samenvoegen; anders beide behouden en correct koppelen.

## Controle

- Dezelfde gekoppelde vestigingen en relaties zijn zichtbaar in beide projecten.
- Eigendom & UBO is niet langer 0 wanneer de bron gegevens bevat.
- Green House wordt niet aangepast op basis van alleen een postcodeverschil.
- Factuurvelden en handmatig ingevoerde ledengegevens blijven onaangetast.
