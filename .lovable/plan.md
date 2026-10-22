# Onderzoek: wachtwoordresetmails komen niet aan (alleen-lezen)

Er is niets gewijzigd, verstuurd of gepubliceerd.

## Bewezen (gecontroleerd vandaag)

1. **Resetroute in de code:** `src/pages/LoginPage.tsx` r. 209-210 roept de standaard reset van de inlogdienst aan, met terugkeer naar `/reset-password` (`src/pages/ResetPasswordPage.tsx`). De app verstuurt de resetmail niet zelf.
2. **Reset liep nooit via Resend.** Resend wordt alleen gebruikt in `supabase/functions/send-transactional-email/index.ts` (r. 13, 526-600) voor appmails. Er is geen eigen SMTP en geen route voor eigen inlogmails (`/lovable/email/auth/webhook` bestaat niet). `src/lib/memberAuthEmailTemplate.ts` is alleen voorbereid en niet actief.
3. **Inlogmails gingen nooit via de eigen mailwachtrij.** Het verzendlog bevat nul inlogmails (recovery/signup/magiclink/invite). Wel appmails van 2026-05-13 tot de laatste op 2026-10-16 08:47 UTC.
4. **E-maildomein `notify.leden.coffeeshopbond.nl` heeft status Failed:** "provisioning timed out — niet geverifieerd binnen 14 dagen". Het TXT-record staat er. De NS-records naar ns5/ns6.lovable.cloud ontbreken. Dat klopt met wat je in de openbare DNS ziet.
5. **Inlogregistratie:** de afgelopen periode staat er geen resetaanvraag (`/recover`) in. Er is dus geen concrete foutmelding met datum over een geweigerde of mislukte resetmail.

## Hypotheses (niet bewezen)

- **A.** Door de mislukte domeinverificatie zit de verzending van inlogmails in een tussenstand. Ze gaan dan niet via de eigen afzender en mogelijk ook niet meer goed via de standaardafzender. Dit is het meest waarschijnlijk, maar de verzendinstellingen van de inlogdienst kan ik niet zien.
- **B.** De mails worden wel verstuurd vanaf de standaardafzender, maar komen in spam of worden door de ontvanger tegengehouden.
- **C.** Een limiet op het aantal inlogmails per uur. Daar zijn geen meldingen van gevonden.
- Los hiervan: sinds 16 oktober zijn er ook geen appmails meer gelogd. Dat kan normaal zijn (er gebeurde niets) of een tweede probleem. Niet onderzocht.

## Wat ik niet kan zien

- De actuele verzendinstellingen van de inlogdienst (afzender, of de eigen mailkoppeling aan staat).
- Leveringslogs van de mailprovider (bezorgd, bounce, spam).
- Het Resend-dashboard en of `leden.coffeeshopbond.nl` daar geverifieerd is. De records `resend._domainkey.leden` en `send.leden` wijzen daar wel op.
- Inlogregistraties ouder dan de bewaartermijn.

## Herstelopties zonder NS-delegatie (pas na jouw akkoord)

1. **Eigen e-mailinstellingen uitzetten:** onder Meer → E-mails de mislukte eigen e-maildomeininstelling uitschakelen. Inlogmails gaan dan zeker via de standaardafzender van Lovable Cloud, zonder DNS-wijziging. Gevolg: geen BCD-huisstijl en een niet-BCD-afzender. Appmails via Resend blijven werken, want die gebruiken die instelling niet.
2. **Overstappen naar een DNS-beheerder die wel NS-records ondersteunt,** of het domein naar Lovable verhuizen. Dat is wel een DNS-wijziging, maar zonder dat 3WT iets hoeft te doen.
3. **Tijdelijke noodoplossing:** een beheerder stelt het wachtwoord in via Accountbeheer of Meer → Users.

Resetmails via Resend laten lopen wordt voor Lovable Cloud-inlogmails niet ondersteund en stel ik daarom niet voor.

## Voorgestelde vervolgstap (na akkoord)

1. Optie 1 uitvoeren.
2. Daarna één reset aanvragen voor een eigen testadres.
3. In de inlogregistratie bevestigen dat de aanvraag is gelukt.
