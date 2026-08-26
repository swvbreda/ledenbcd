# Vertegenwoordigde coffeeshops niet meer laten dalen door oude bewerkingen

## Vastgestelde oorzaak

- Het actuele ledenbestand bevat **166 echte locatierijen**: 160 bij leden en 6 bij leads.
- De centrale statistiekfunctie en de frontend geven een volledige `locaties`-lijst uit `member_edits` echter voorrang boven de actuelere lijst in `members_data`.
- Bij 11 leden wijken die lijsten af. De oude bewerkingen halen per saldo 7 locaties weg: **166 − 7 = 159**.
- Greenhouse toont het probleem concreet: in `members_data` staan 6 locaties, inclusief Greenhouse Lounge, maar een oude bewerking van **2 april 2026** bevat nog 5 locaties en vervangt daardoor de actuele lijst.
- Er zijn momenteel **137 bevestigde unieke registershops** gekoppeld. Een koppeling hoort een bestaande locatie niet dubbel te tellen; een werkelijk extra gekoppelde shop moet wel als extra vertegenwoordigde coffeeshop meetellen.

## Oplossing

1. De 11 afwijkende leden veilig herstellen door de actuele basislocaties en goedgekeurde bewerkingen per locatie samen te voegen, zonder factuurgegevens of andere lidgegevens te overschrijven.
2. Locaties herkennen op postcode, adres en naam, zodat gecorrigeerde locaties worden bijgewerkt en nieuwe registerlocaties niet verdwijnen door een oudere bewerkingssnapshot.
3. De centrale databaseberekening dezelfde samenvoeglogica laten gebruiken in plaats van `member_edits.locaties` blind als volledige vervanging te behandelen.
4. De frontend dezelfde effectieve locatielijst laten gebruiken, zodat ledenkaart, dashboard, gemeenten en register allemaal exact dezelfde locaties en totalen tonen.
5. Nieuwe adminbewerkingen voortaan opslaan tegen de nieuwste effectieve gegevens, zodat een oud formulier later geen inmiddels toegevoegde registerlocaties kan verwijderen.
6. Na herstel per afwijkend lid controleren welke locaties zijn toegevoegd, gewijzigd of bewust verwijderd; verwijderingen blijven expliciet en worden niet automatisch teruggezet.
7. Eindcontrole uitvoeren op Greenhouse en alle andere afwijkende leden, en het totaal vergelijken tussen dashboard, ledenbestand, gemeentepagina en registerkoppelingen.

## Technisch

- Eén gedeelde locatie-merge op basis van genormaliseerde postcode, adres en naam; geen optelling van twee arrays zonder ontdubbeling.
- De SQL achter `get_representation_stats()` krijgt dezelfde effectieve-locatieregels als de frontend.
- Een bevestigde registershop telt één keer. Niet-gekoppelde echte ledenlocaties worden aanvullend geteld.
- De eenmalige datareparatie gebruikt fetch-and-merge en beperkt zich tot locatiegegevens; factuurvelden blijven onaangetast.
- Verificatie rapporteert apart: opgeslagen locaties, effectieve unieke locaties, bevestigde registershops en niet-gekoppelde locaties.
