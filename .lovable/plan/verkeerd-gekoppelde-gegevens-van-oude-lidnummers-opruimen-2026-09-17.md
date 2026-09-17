# Verkeerd gekoppelde gegevens van oude lidnummers opruimen

Je hebt gelijk: die adressen hoorden bij andere leden.

- silviow1968@gmail.com is van 85 The Stud, maar stond bij 83 1e Hulp
- hsmile@xs4all.nl is van 95 Happy Smile, maar stond bij 90 Pleasure
- nultien_rotterdam@hotmail.com is van 117 Coffeeshop 010, maar stond bij 107 Club Media

Oorzaak: bij een eerdere hernummering van de lidnummers zijn de mailingvoorkeuren niet meegenummerd. Ze bleven aan het oude nummer hangen, dat inmiddels een ander lid is. De verschuiving is telkens een vast aantal plaatsen (+2, +5, +10), wat dit bevestigt.

De mailingvoorkeuren van de huidige leden zijn hiermee al rechtgezet (verouderde vinkjes weg, eigen adressen aangevinkt). Wat nog openstaat:

## Wat er gebeurt

1. **Resten van verdwenen lidnummers opruimen**
   Er staan nog regels op lidnummers die niet meer bestaan: 8 mailingvoorkeuren, 8 WhatsApp-statussen, 2 financiële taken, 2 profielwijzigingen, 1 factuur, 1 betaling, 1 contributie en 1 toegangsadres. Ik toon eerst per regel wat het is en bij welk lid het vermoedelijk hoorde; alleen daarna worden ze verwijderd of overgezet, in overleg bij alles wat met geld te maken heeft (factuur, betaling, contributie).

2. **Toegangsadressen controleren**
   De adressen die toegang geven tot een ledenprofiel zijn nagelopen: op één na (info@coffeeshop-regine.nl bij een verdwenen nummer) horen ze allemaal bij het juiste lid. Dat ene adres wordt verwijderd.

3. **Herhaling voorkomen**
   Bij archiveren worden de gegevens al automatisch meegenummerd, maar twee tabellen ontbreken daar nog: de gelieerde leden en de logo-opt-out. Die worden toegevoegd, zodat er in de toekomst niets meer op een verkeerd lid belandt.

4. **Eindcontrole**
   Daarna een controle over alle ledentabellen dat elk lidnummer nog bestaat, met het resultaat in de chat.

## Technisch

- Alleen dataopruiming via run_sql in `member_mailing_preferences`, `member_whatsapp_status`, `finance_todos`, `member_edits`, `member_allowed_emails` en (na akkoord) `contribution_invoices`, `contribution_payments`, `member_contributions`.
- Eén migratie: `archive_member_with_renumber` krijgt `member_affiliations` en `shop_logo_optout` in de lijst met om te nummeren tabellen.
- Geen wijziging aan `members_data` en geen UI-wijziging.
