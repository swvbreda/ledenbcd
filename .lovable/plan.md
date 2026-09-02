# Achterliggende B.V.'s bij de locaties tonen

Het losse blok "Vergunninghouders & eigenaren" onderaan het ledenprofiel verdwijnt. Die informatie (vergunninghoudende onderneming, exploitant, KvK, vestigingsnummer en eigendomsketen) komt op de locatiekaart zelf te staan, bij de vestiging waar hij hoort.

## Wat er verandert

Per locatiekaart komt een blok "Onderneming" boven het huidige Register-blok:

```text
Hunters Amsterdam Centrum        Gemeente Amsterdam  Centrum
Utrechtsestraat 14
1017 VN Amsterdam

ONDERNEMING
Vergunninghouder   Hunters V B.V.
Exploitant         Hunters V B.V.
KvK-nummer         12345678
Vestigingsnr.      000012345678

EIGENDOMSKETEN
  Hunters Holding B.V. · KvK ...
    J. Jansen

REGISTER  [Bevestigd]
Dossier ...
```

- De onderneming wordt getoond ook als de vestiging nog niet aan het register gekoppeld is, zolang die gegevens bij het lid zelf bekend zijn.
- Staat er niets bekend, dan komt er "Vergunninghouder onbekend" te staan zodat gaten zichtbaar blijven.
- De eigendomsketen (UBO) staat al op de kaart en blijft daar; hij wordt onder het ondernemingsblok geplaatst zodat de volgorde logisch loopt.
- Vergunninghouder/exploitant verdwijnen uit het Register-blok (staan straks dubbel); dat blok houdt dossier, vergunningnummer en status.

## Technisch

- `src/components/register/LocationRegisterInfo.tsx`: nieuwe props `memberVergunninghouder`, `memberExploitant`, `memberVestigingsnummer`. Nieuw "Onderneming"-blok dat lid-data laat voorgaan op registerdata (zelfde patroon als `memberKvk`). KvK-regel verhuist naar dit blok; het KvK-blok houdt alleen nog vestiging sinds/website. `Vergunninghouder`- en `Exploitant`-rijen worden uit het Register-blok verwijderd. Volgorde: logo → Onderneming → Contact/website → Social media → Eigendomsketen → Register.
- `src/pages/MemberDetail.tsx`: de nieuwe props doorgeven vanuit `loc.vergunninghouder` / `loc.exploitant`; import en render van `VergunninghoudersOverzicht` en de `vergunninghouderRows`-memo verwijderen.
- `src/components/members/VergunninghoudersOverzicht.tsx` wordt verwijderd (geen andere gebruikers).

Alleen presentatie; geen data- of backendwijzigingen.
