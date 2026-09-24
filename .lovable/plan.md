# Ledenverloop weer tonen

## Wat er aan de hand is
De grafiek verschijnt alleen als van minstens 80% van de leden het startjaar bekend is. Dat is nu bij 57 van de 117 leden zo (49%), dus de grafiek blijft leeg. Dat komt uit een eerdere correctie, waarbij de vaste historie is weggehaald.

## Oplossing
- De grafiek toont weer de bekende historie per jaar (2005–2025: 29 → 91 leden). Die cijfers stonden al in de app.
- Het huidige jaar gebruikt altijd het echte, actuele aantal leden uit het ledenbestand (nu 117). Er staat dus geen vast getal in.
- "t.o.v. vorig jaar" en "5 jaar" worden weer berekend (bijvoorbeeld 91 → 117).
- Voor gewone leden verandert er niets aan wat ze mogen zien. De historie bestaat alleen uit totalen per jaar, zonder namen.

## Technisch
- `src/lib/verloop.ts`: `buildVerloopSeries` gebruikt eerst `src/data/verloop.json` voor alle jaren vóór het huidige jaar en zet het huidige jaar op `members.length`. Als het bestand een jaar mist, valt het terug op de afleiding uit de startjaren. `reliable` wordt true zodra er historie is.
- `src/components/VerloopChart.tsx`: geen wijziging in de opmaak. De subtitel en de lege toestand volgen vanzelf.
- `src/lib/verloop.test.ts` bijwerken: de historie komt uit het bestand, het huidige jaar is live, en er zijn geen vaste 117.
