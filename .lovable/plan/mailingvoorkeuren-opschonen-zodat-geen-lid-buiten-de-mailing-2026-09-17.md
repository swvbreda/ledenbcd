# Mailingvoorkeuren opschonen zodat geen lid buiten de mailing valt

Ja — die vijf adressen stonden niet in de lijst van 145. De oorzaak is gecontroleerd: bij deze leden staan in de mailingvoorkeuren nog oude adressen aangevinkt die niet meer in het ledendossier voorkomen, waardoor het huidige adres niet wordt meegenomen.

Wat de controle over alle 116 aangesloten leden liet zien:
- 82 leden hebben minimaal één geldig aangevinkt adres
- 49 leden hebben (ook) een aangevinkt adres dat niet meer in hun gegevens staat
- 5 leden hebben helemaal geen e-mailadres bekend

Voorbeelden: 83 1e Hulp heeft silviow1968@gmail.com aangevinkt, 90 Pleasure hsmile@xs4all.nl, 107 Club Media nultien_rotterdam@hotmail.com. Bij 113 Coffeeshop Oost en 115 De Tulp is nooit iets aangevinkt.

## Wat er gebeurt

1. **Oude, niet meer bestaande adressen uitvinken**
   Voor alle aangesloten leden worden aangevinkte adressen verwijderd die niet meer voorkomen in hun hoofdadres, tweede adres, factuuradres of contactpersonen.

2. **Leden zonder aangevinkt adres alsnog aanvinken**
   Blijft een lid daarna zonder aangevinkt adres achter, dan worden al zijn bekende adressen aangevinkt (hoofdadres, tweede adres, factuuradres en adressen van contactpersonen). Zo valt geen enkel lid met een bekend adres nog buiten de mailing. Leden die bewust volledig zijn uitgevinkt (bewaard als uitschrijfmarkering) blijven uitgeschreven.

3. **Vijf leden zonder enig e-mailadres**
   65 El Marssa, 82 Het Ballonnetje, 108 Paradox, 109 Mediterrané en 125 Baba Souvenir krijgen een notitie in hun profiel met het verzoek een e-mailadres op te halen.

4. **Controle achteraf**
   Na de aanpassing wordt opnieuw geteld hoeveel leden minstens één aangevinkt adres hebben en welke adressen nieuw in de mailinglijst komen; dat overzicht krijg je in de chat, zodat je de lijst opnieuw kunt exporteren via de knop Mailinglijst.

## Technisch

- Alleen data in `member_mailing_preferences` (delete van verouderde rijen, insert van ontbrekende), plus notities in `member_notes` voor de vijf leden zonder adres.
- Adressen worden hoofdletterongevoelig vergeleken en ontdubbeld; lege sentinel-rijen (bewuste opt-out) blijven ongemoeid.
- Geen wijziging aan `members_data`, geen schema- of UI-wijziging.
