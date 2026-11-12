# Eigen bestuurstaken afronden vanuit notulen

## Bevestigde oorzaak
De taakknoppen en algemene taakwijzigingen zijn uitsluitend voor beheerders. De actuele alleen-lezen controle vindt 8 bestuursnamen en 7 gekoppelde actieve accounts: 6 beheerders en 1 zonder beheerrol. De eerdere aanname dat alle gekoppelde bestuursaccounts beheerders zijn, geldt niet meer. Alleen een knop toevoegen lost dit niet veilig op.

## Gerichte reparatie
- Laat een actief bestuurslid uitsluitend zijn expliciet toegewezen of gedeelde bestuurstaak afronden en heropenen vanuit de notulen.
- Behoud één bestaande taakstatus, afrondregistratie en alle actie-/versiekoppelingen.
- Toon de statusknop per toegestane taak; Taak openen in Projecten en Toewijzing blijven uitsluitend voor beheerders.
- Behoud de 15 geactiveerde taken, historische teksten, documenten en huidige inlogreparaties.
- Geen accounts, rollen, algemene projectrechten, berichten, taakactivatie of publicatie.

## Technische uitvoering
- Voeg een smalle databasefunctie toe voor uitsluitend statusovergangen op bestaande private notulentaken. Controleer ingelogde identiteit, actief account, huidige echte bestuursregistratie én bestaande toewijzing server-side; beheerders behouden hun bediening.
- Geef per taak een serverberekende statusbevoegdheid terug; `can_manage` blijft admin-only.
- Onderzoek bestaande triggers en gebruik dezelfde afrond-/heropenregistratie. Algemene taak-RLS en overige veldmutaties blijven ongewijzigd.
- Pas alleen notulentaakbediening, noodzakelijke aanroep/types en de architectuurregel voor deze beperkte uitzondering aan.

## Verificatie
- Geïsoleerde tests: toegewezen actief bestuurslid toegestaan; niet-toegewezen bestuurslid, lid, extern, ontbrekende sessie en ingetrokken/inactief account geweigerd.
- Gedeelde taak: één afronding voor iedereen, heropening dezelfde taak, juiste actor/tijd, geen andere veldwijzigingen of berichten.
- Bestaande renderchecks en gerichte nieuwe bevoegdheidstests plus automatische bouwcontrole.
- Geen echte productietaken afronden/heropenen als test; ingelogde gebruikerscontrole indien geen bestaande toegestane sessie beschikbaar is.
