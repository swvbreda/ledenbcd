Ik heb de ruwe bankdata gecontroleerd. Conclusie: het staat niet dubbel in één bankafschrift, maar dezelfde betaling komt uit twee bronnen binnen:

- **ABN-import** uit het handmatig geüploade bankafschrift
- **Ponto-live** uit de automatische bankkoppeling

Voorbeelden:

| Factuur | Bedrag | Gevonden in |
|---|---:|---|
| 2026-0006 | € 9.110,40 | ABN 26-03 + Ponto 25-03 |
| 2026-0008 | € 7.550,40 | ABN 29-04 + Ponto 28-04 |
| 2026-0010 | € 7.550,00 | ABN 29-05 + Ponto 31-05 |

Dat kleine datumverschil komt door boekingsdatum vs. uitvoerdatum. Daardoor zie je ze als losse regels, terwijl het administratief dezelfde betaling is.

Plan om dit goed te maken:

1. **Deduplicatie aanscherpen**
   - Match ABN en Ponto op factuurnummer + bedrag, ook wanneer het factuurnummer in de volledige omschrijving staat.
   - Negeer datumverschillen van een paar dagen bij dezelfde factuur.

2. **Bronkeuze vastleggen**
   - Als dezelfde betaling in ABN én Ponto staat, toon maar één regel.
   - Gebruik bij voorkeur de Ponto-live regel, omdat die automatisch blijft bijwerken.

3. **Totaal corrigeren**
   - Zorg dat de tabel en totaaltelling dezelfde ontdubbelde lijst gebruiken.
   - Hierdoor hoort Strategiebureau niet meer op € 71.508,60 uit te komen, maar op de som van unieke facturen.

4. **Controle na wijziging**
   - Heropen de Strategiebureau-transactietabel en check dat facturen 2026-0006, 2026-0008 en 2026-0010 nog maar één keer zichtbaar zijn.