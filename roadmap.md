# Roadmap

## Open
- [ ] Coffeeshopregister-sync: Beleidsmonitor moet het export-endpoint `/api/public/hooks/bcd-register-export` publiceren, óf in het bronproject weer `GRANT SELECT ON public.coffeeshop_vergunningen, public.gemeenten TO anon;` zetten. Zonder een van beide blijft de sync stranden op 401.

## Klaar
- [x] Push-/koppelsleutels opnieuw ingevoerd (REGISTER_PUSH_SECRET, COFFEESHOPBELEID_API_SECRET, BCD_KOPPEL_SLEUTEL)
- [x] Certificaatfout `coffeeshopbeleid.nl` opgelost: basisadres instelbaar (standaard `.com`) + terugval bij netwerkfouten
- [x] Beleidsmonitor-sync (leden push/dossiers) werkt: 173 verstuurd, 174 dossiers
