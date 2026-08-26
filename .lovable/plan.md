# Vergunninghouder en eigenaar per locatie, niet per lid

## Wat er nu misgaat

Het register levert per vestiging een vergunninghoudende BV (bijv. Sensi Smile B.V. voor Hunters Papaverweg). De verrijking maakt daar nu een voorstel van op **lidniveau** ("Algemene ledengegevens → Bedrijfsnaam / KvK, beïnvloedt facturatie"). Dat is onjuist: binnen één lid kunnen meerdere BV's en eigenaren voorkomen.

## Wat er verandert

1. **Voorstellen worden locatiegebonden**
   - De register-BV en het register-KvK worden niet langer als lidvoorstel voor `bedrijfsnaam`/`kvk` aangeboden.
   - In plaats daarvan komen ze binnen als locatievoorstel op de velden `vergunninghouder` en `kvk` van die specifieke vestiging, met adrescontext in de kop (zoals nu al bij Gemeente/Postcode).
   - Het lidveld `bedrijfsnaam` (factuurnaam) blijft handmatig; alleen als een lid precies één vestiging heeft en nog geen bedrijfsnaam kent, blijft een lidvoorstel mogelijk.
   - Bestaande openstaande lidvoorstellen voor `bedrijfsnaam`/`kvk` die uit het register komen, worden opgeruimd zodat de lijst schoon is.

2. **Overzicht "Vergunninghouders & eigenaren" op de ledenpagina**
   - Nieuw blok op de leddetailpagina dat per lid alle onderscheiden BV's toont: vergunninghouder/exploitant, KvK, vestigingsnummer, bijbehorende UBO's, en welke locaties eronder vallen.
   - Zijn er meerdere verschillende BV's of eigenaren binnen één lid, dan wordt dat expliciet zichtbaar (bijv. "3 vergunninghouders over 5 vestigingen").
   - Locaties zonder bekende vergunninghouder worden apart gegroepeerd als "onbekend".

3. **Kerngegevens**
   - De telling van vergunninghouders/eigenaren gaat uit van unieke BV's per vestiging in plaats van één BV per lid, zodat het aantal onderscheiden ondernemingen klopt.

## Technisch

- `supabase/functions/enrich-members-from-register/index.ts`: het `sensitive` blok (bedrijfsnaam/kvk op scope `lid`) vervalt; `vergunninghouder`, `exploitant` en `kvk` worden als locatievoorstel behandeld met bron `register`/`kvk`.
- `src/components/register/RegisterEnrichmentPanel.tsx`: label "beïnvloedt facturatie" alleen nog bij echte lid-factuurvelden; locatievoorstellen tonen de vestigingsnaam en het adres.
- Nieuw component `src/components/members/VergunninghoudersOverzicht.tsx`, ingehangen in `src/pages/MemberDetail.tsx`, gevoed door `Location.vergunninghouder/exploitant/kvk/ubo` plus de register-UBO-bulkhook.
- Opschoonmigratie/SQL voor openstaande `register_enrichment_proposals` met `scope = 'lid'` en `field in ('bedrijfsnaam','kvk')`.
