# Aanmelden: al-aangemelde shops tonen en niet-leden toevoegen

## Waarom je Mississippi niet vond
Coffeeshop Mississippi (lid 73) staat al aangemeld voor de Experiment bijeenkomst van 30 september. Shops die al aangemeld zijn, verdwijnen nu uit de zoeklijst.

## Wat er verandert
- **Al aangemeld:** zulke shops blijven zichtbaar in de zoeklijst, grijs met het label "Al aangemeld". Je kunt ze niet nog een keer kiezen.
- **Oud-leden:** komen erbij in de zoeklijst, met het label "Oud-lid". Aanmelden werkt net als bij een lid.
- **Alle coffeeshops uit het register:** een extra groep "Overige coffeeshops" met elke actieve shop in Nederland die geen lid, lead of oud-lid is. Zoeken op naam of plaats. Kies je zo'n shop, dan vul je naam en e-mail van de contactpersoon zelf in. De aanmelding komt bij de gasten van de bijeenkomst te staan, met de shopnaam als organisatie.
- De zoektekst wordt: "Zoek een bestuurslid, lid, oud-lid of coffeeshop…".
- Er gaan bij het opslaan geen extra mails of agenda-uitnodigingen uit: de pauze op de Outlook-koppeling blijft staan.

## Technisch
- `AgendaDeelnemersDialog.tsx`:
  - `candidates` uitbreiden met oud-leden (uit de ledencontext) met label "Oud-lid"; aangemelde leden/bestuur niet meer wegfilteren maar `disabled` tonen met label.
  - Nieuwe selectievorm `{ kind: "register", id }`; registershops ophalen via de bestaande hook voor het coffeeshopregister (alleen meetellende shops), gematchte leden/leads/oud-leden eruit filteren.
  - Bij een registershop: verplichte velden contactnaam en e-mail; opslaan als rij in `agenda_guest_registrations` (naam, organisatie = shopnaam + plaats, e-mail, gasten, opmerking, status bevestigd). Die gasten staan al in het overzicht van de bijeenkomst.
- Geen databasewijziging nodig; alleen bestuur/beheer ziet dit formulier.
- Controle in de preview met een ingelogde sessie: Mississippi zichtbaar als "Al aangemeld", een oud-lid en een registershop aanmelden en terugzien in de lijst.
