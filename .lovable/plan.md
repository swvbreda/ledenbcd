# Verkeerde registerkoppeling ongedaan maken

## Doel
De zojuist bevestigde koppeling **De Republiek (Amsterdam) → Siberië (lid #30)** veilig terugdraaien en zorgen dat elke bevestiging voortaan eenvoudig ongedaan kan worden gemaakt.

## Aanpak
1. De gevonden koppeling terugzetten van `bevestigd` naar `afgewezen`, zodat De Republiek niet meer als coffeeshop van Siberië wordt getoond.
2. In het registeroverzicht bij bevestigde koppelingen een duidelijke actie **Ontkoppelen** toevoegen; nu is die alleen beschikbaar in het detailvenster en daardoor moeilijk vindbaar.
3. Na bevestigen een melding met **Ongedaan maken** tonen, zodat een verkeerde klik direct kan worden hersteld.
4. Voor ontkoppelen een korte bevestiging tonen met beide namen, om te voorkomen dat opnieuw de verkeerde relatie wordt aangepast.
5. Controleren dat Siberië zijn overige juiste voorstellen/koppelingen behoudt en dat er geen lidgegevens worden teruggedraaid. Voor deze koppeling zijn geen aanvullingsvoorstellen toegepast.

## Technische details
- Gebruik de bestaande statusovergang op `coffeeshop_member_links`; geen records verwijderen.
- Werk de bestaande `useSetRegisterLink`-mutatie en registerlijst bij en ververs daarna de koppelingen-cache.
- De actie blijft beperkt tot gebruikers die de beveiligde bestuurspagina kunnen gebruiken.
