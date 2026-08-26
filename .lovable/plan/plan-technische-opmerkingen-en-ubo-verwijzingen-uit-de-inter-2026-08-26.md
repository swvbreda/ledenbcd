# Plan: technische opmerkingen en UBO-verwijzingen uit de interface halen

## Doel
Alle zichtbare technische opmerkingen die vragen oproepen bij het bestuur verwijderen of neutraler maken, met name teksten zoals “openbaar, zonder UBO” en expliciete “UBO”-vermeldingen in gewone overzichtsschermen.

## Aanpak
1. **Registerstatus opschonen**
   - Op de Coffeeshopregister-pagina de regel “Laatste sync: datum · status” aanpassen zodat de technische status niet meer zichtbaar is.
   - Alleen een neutrale laatste-bijwerkdatum tonen, bijvoorbeeld “Bijgewerkt: datum”, of de regel helemaal weglaten als er geen datum is.

2. **Bron-/uitlegregels verwijderen**
   - Op de Kerngegevens-pagina de kleine bronregels onder sectietitels verwijderen, zoals “Aantal vestigingen per lid uit het ledenbestand”, “Top 10 op aantal vestigingen” en vergelijkbare toelichtingen.
   - De inhoud, cijfers en diagrammen blijven staan; alleen de verklarende microcopy verdwijnt.

3. **UBO-taal neutraliseren**
   - In locatiekaarten en registerinformatie zichtbare labels zoals “Eigendomsketen (UBO)” aanpassen naar een neutralere bestuurstaal, bijvoorbeeld “Eigendomsketen”.
   - Technische aanduidingen zoals “· UBO” bij namen verbergen of vervangen door een minder beladen label als dat nodig is.

4. **Controle op vergelijkbare UI-teksten**
   - De frontend doorzoeken op zichtbare teksten met “UBO”, “zonder UBO”, “openbaar”, “bron” en vergelijkbare bron-/sync-opmerkingen.
   - Alleen gebruikerszichtbare interface-teksten aanpassen; technische comments of backendvelden blijven intact tenzij ze rechtstreeks in de UI verschijnen.

## Technische details
- Wijzigingen zitten naar verwachting in:
  - `CoffeeshopRegisterPage`: statusregel bij synchronisatie.
  - `KerngegevensPage`: optionele `bron`-regels onder sectietitels.
  - `LocationRegisterInfo`: labels rond eigendoms-/registerinformatie.
- Geen datamodelwijziging nodig.
- Geen data wordt verwijderd; alleen presentatie wordt opgeschoond.

## Verificatie
- Controleren dat “openbaar, zonder UBO” nergens meer zichtbaar is.
- Controleren dat bestuurspagina’s nog dezelfde kerncijfers en koppelinformatie tonen.
- Controleren dat locatiekaarten geen onnodige “UBO”-opmerkingen meer tonen.
