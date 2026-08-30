# Plan: Ledenbestand-app opnieuw indienen bij de App Store

## Situatie
Apple heeft de app (versie 1.0, iOS) niet afgewezen maar **gepauzeerd** met Guideline 2.1(b) — "Information Needed". Ze willen het verdienmodel begrijpen omdat de app lijkt te werken met betaalde lidmaatschappen. We hoeven dus geen code te wijzigen — we moeten **5 vragen beantwoorden** in App Store Connect en daarna opnieuw indienen.

## Antwoorden op de 5 vragen van Apple (concept, ter goedkeuring)

1. **Wie zijn de gebruikers van de betaalde diensten?**
   De leden van de Bond van Cannabis Detaillisten (BCD): eigenaren van coffeeshops in Nederland die lid zijn van de branchevereniging. Het is een besloten ledenportaal, geen consumentenapp.

2. **Waar kunnen gebruikers de diensten kopen?**
   Nergens digitaal. Het lidmaatschap (jaarlijkse contributie) wordt afgesloten buiten de app om, via de vereniging zelf, en wordt betaald per bankoverschrijving op factuur. Er is geen aankoop of betaling mogelijk in de app.

3. **Welke eerder gekochte diensten krijgt een gebruiker te zien?**
   Geen digitale content of diensten die via de app worden verkocht. Leden zien alleen gegevens van hun eigen vereniging: ledenbestand, agenda, documenten en verenigingsinformatie. Dit valt onder het "reader/enterprise" model — de app geeft toegang tot een bestaand (verenigings)lidmaatschap.

4. **Welke betaalde content wordt ontgrendeld zonder In-App Purchase?**
   Geen. Alle functies van de app zijn onderdeel van het bestaande verenigingslidmaatschap dat volledig buiten de app om loopt. Er wordt in de app niets verkocht, ontgrendeld of afgerekend.

5. **Hoe krijgt men een account? Moet men betalen voor een account?**
   Een account is gratis, maar alleen beschikbaar voor bestaande BCD-leden. Een lid vraagt toegang aan via het portaal; het bestuur keurt de aanvraag goed en er wordt een uitnodigingsmail gestuurd. Niet-leden kunnen geen account aanmaken.

## Stappen
1. In App Store Connect: open de submission (ID c58817b6-...) → "App Review" bericht → antwoord met bovenstaande tekst (Nederlands of Engels mag).
2. Geen nieuwe build nodig: na het antwoord hervat Apple de review van dezelfde build.
3. Optioneel (aanbevolen): in App Store Connect bij "App Review Information" een demo-account + notitie toevoegen dat de app een besloten ledenportaal is, zodat volgende reviews sneller gaan.

## Technische details
- Geen codewijzigingen in de app nodig.
- Als Apple alsnog een demo-account wil, maken we een read-only testaccount aan in Lovable Cloud.
