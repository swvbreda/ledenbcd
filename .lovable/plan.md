# Registergegevens aanvullen en aan leden koppelen

## Wat er nu misgaat

De dagelijkse levering vanuit Coffeeshopbeleid bevat alleen naam, adres, vergunningstatus en vergunningnummer. Van de 606 shops in het register is bij alle 606 het logo, de socials, de oprichtingsdatum, de website, het telefoonnummer en de exploitant leeg — er valt dus niets te koppelen aan de leden. Alleen bij 84 shops staat een KvK-nummer, opgehaald via onze eigen KvK-aanvulling, die maar 40 shops per keer doet en daarna stil is blijven staan.

## Wat we gaan doen

1. **KvK-gegevens zelf ophalen** voor de shops: KvK-nummer, vestigingsnummer, oprichtingsdatum en de naam van de onderneming. Eerst de shops die aan een lid gekoppeld zijn (143 stuks), daarna in dagelijkse rondes de rest van het register. Bestaande gegevens worden nooit overschreven; lege velden worden aangevuld.
2. **Logo's automatisch ophalen** van de website van de shop of het lid (logo of icoon van de site), opgeslagen bij ons zodat het altijd blijft werken. Het lid kan in zijn eigen profiel een eigen logo uploaden; dat gaat altijd voor op het automatisch opgehaalde logo.
3. **Socials automatisch herkennen** (Instagram, Facebook, LinkedIn, X) uit de website van de shop, zodat die bij de vestiging komen te staan.
4. **Zichtbaar maken bij het lid**: op de vestigingskaart in het ledenprofiel komen logo, oprichtingsdatum, website en socials te staan, naast de al bestaande KvK- en vergunninggegevens. De eigendomsketen blijft zoals afgesproken alleen op de registerpagina.
5. **Dagelijks bijwerken**: de aanvulling draait elke nacht mee, zodat nieuwe shops en nieuwe leden vanzelf worden aangevuld. Op de registerpagina komt te zien hoeveel shops al aangevuld zijn en wanneer dat voor het laatst gebeurde.

## Volgorde

- Ronde 1 (direct): shops van leden — KvK-gegevens, logo's en socials.
- Ronde 2 (de nachten daarna): de overige shops in het register.

## Technische uitvoering

- `supabase/functions/enrich-members-from-register/index.ts`: verwerkingsvolgorde eerst op shops met een bevestigde `coffeeshop_member_links`-rij, daarna de rest; batchgrootte verhogen en doorlopen tot de KvK-limiet; `kvk_vestigingsnummer`/`kvk_vestiging_datum` daadwerkelijk wegschrijven; handelsnaam/onderneming overnemen naar `exploitant` alleen wanneer dat veld leeg is.
- Nieuwe stap in dezelfde functie: website bepalen (registerveld, ledenwebsite), pagina ophalen, `og:image`/`apple-touch-icon`/logo en social-links uitlezen; afbeelding opslaan in een storage-bucket voor shoplogo's en de publieke URL in `coffeeshop_register.logo_url` zetten; gevonden links in `socials` (jsonb). `oprichtingsdatum`/`oprichtingsdatum_bron` vullen vanuit de KvK-datum als `oprichtingsdatum` leeg is. Elke shop krijgt `verrijkt_op`; mislukte pogingen worden gemarkeerd zodat ze niet elke nacht opnieuw worden geprobeerd.
- Overname naar het lid: bestaande registerkoppeling per vestiging gebruiken; in `LocationRegisterInfo.tsx` logo, oprichtingsdatum, website en socials tonen. Het door het lid geüploade logo (`useMemberLogo`) krijgt voorrang.
- Cron: aanvulronde toevoegen na de bestaande nachtelijke registersync.
- Statusblok op `CoffeeshopRegisterPage.tsx` uitbreiden met aantallen (logo/oprichtingsdatum/KvK gevuld) en laatste aanvulronde.
