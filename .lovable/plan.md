Publicatiecontrole Contacten (alleen-lezen, 9 nov 2026) — geen verdere actie nodig

Resultaat: de nieuwe versie is live.

- https://ledenbcd.lovable.app stuurt door (302) naar https://leden.coffeeshopbond.nl/
- /contacten geeft HTTP 200, paginatitel "Contacten — BCD", en laadt de nieuwe bestanden contacten.index, AddressBookPage en _dashboard
- Het detailbestand contacten._id staat ook online; /contacten/<id> geeft HTTP 200
- AddressBookPage bevat "Organisatie toevoegen" en leest de nieuwe adresboektabellen

Beperkingen: deploymentstatus en broncommit zijn niet via het platform uitgelezen. Er is niet ingelogd getest, dus menu, rechten en opslaan zijn niet live in de browser gecontroleerd. Niets gewijzigd of opnieuw gepubliceerd.
