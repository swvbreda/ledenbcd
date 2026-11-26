# Enquête opslaan herstellen voor leden

## Wat er misgaat
Leden zien bij het versturen van een enquête (zoals "Verzuimverzekeringen voor coffeeshops") de melding dat het opslaan geweigerd wordt. De beveiligingsregel van de database laat ingelogde leden alleen antwoorden opslaan als er een e-mailadres bij staat. Ledenantwoorden worden juist anoniem opgeslagen, zonder e-mailadres, dus elk ledenantwoord wordt geweigerd. De stickeraanvraag werkt via een eigen route en heeft hier geen last van.

## Oplossing
Een extra beveiligingsregel toevoegen: een ingelogd lid (of beheerder) mag anonieme antwoorden opslaan, alleen voor een actieve enquête.

- De stickerenquête blijft uitgesloten van rechtstreeks opslaan (bestaande blokkade blijft staan).
- Wie antwoorden mag lezen verandert niet; antwoorden blijven anoniem.
- Openbare/externe enquêtes blijven werken zoals nu.
- Geen bestaande antwoorden of enquêtes wijzigen, geen mails.

## Technisch
- Migratie: `CREATE POLICY "Members can insert anonymous responses for active surveys" ON public.survey_responses FOR INSERT TO authenticated WITH CHECK (respondent_email IS NULL AND (has_role(auth.uid(),'user') OR has_role(auth.uid(),'admin')) AND EXISTS (active survey))`. De restrictieve sticker-policy blijft gelden.
- Controleren dat `survey_completions`-insert (eigen user_id) al toegestaan is — dat is zo.
- Test toevoegen die de regel vastlegt (lid mag anoniem insert op actieve enquête, niet op inactieve of stickerenquête); build controleren. Niet publiceren.
