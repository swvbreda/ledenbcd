# Declaraties naar Informer – read-only controle (8 okt 2026)

## Zelf gecontroleerd (vandaag)
- Declaraties: 37, allemaal "niet verzonden"; 0 Informer-documentnummers.
- Verzendpogingen: 0 (de tabel met pogingen is leeg).
- Geen nieuwe wijzigingen sinds de laatste controle. De laatste wijziging is "Syncfouten structureel opgebouwd" van 7 okt, 21:11 UTC.
- Grootboekrekening: niet ingesteld (de instelling `INFORMER_DECLARATION_LEDGER_ID` bestaat niet). De koppeling kiest nu zelf een rekening waarvan de naam lijkt op reis-, onkosten- of bestuurskosten. Rekeningnummer en omschrijving zijn niet bekend.
- Informer-inloggegevens zijn aanwezig. Er ontbreekt er geen.
- Declaratietests vandaag opnieuw gedraaid: 17/17 geslaagd.
- Er staan geen buildfouten in het buildlogboek.

## Niet vastgesteld
- Welke versie nu live staat: dat kan ik vanaf hier niet zien.
- Het overzicht van wat met Publish meegaat, is dus hetzelfde als bij de vorige controle: (A) de declaratieschermen; (B) eerdere preview-wijzigingen, zoals de kaart, het keuzeveld voor evenementen en bijlagen; (C) de router- en serverupdate.
- Volledige suite (305/305), typecheck, build en beveiligingsscan: dit zijn uitslagen van 7 okt. Ze zijn vandaag niet opnieuw gedraaid.

## Blokkades vóór publiceren
- Geen harde blokkade.
- Oranje: er is geen vaste grootboekrekening. Advies: kies er één en zet die vast.
- Er is nog nooit een echte verzending naar Informer gedaan. De eerste echte declaratie na publiceren is de proef; de penningmeester controleert die in Informer.

## Voorstel na akkoord (nog steeds zonder Informer aan te roepen)
1. De volledige testsuite, typecheck en beveiligingsscan opnieuw draaien.
2. Optioneel: het grootboeknummer vastzetten zodra de penningmeester het nummer opgeeft.
