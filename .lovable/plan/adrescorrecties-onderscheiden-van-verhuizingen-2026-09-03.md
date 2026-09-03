# Adrescorrecties onderscheiden van verhuizingen

## Wat er nu misgaat
In "Aanvullingen vanuit het register" krijgt elk adres- of postcodeverschil van een gekoppelde vestiging het label **Verhuizing**. Voorbeelden uit de lijst (De Os, Zero Zero, Kadinsky, The Happy Family) zijn echter alleen schrijfwijzeverschillen: `8911 LA` → `8911LA`, `Langebrugsteeg 7a` → `Langebrugsteeg 7 a`. Dat is geen verhuizing.

## Aanpak
1. **Vergelijk genormaliseerd.** Voor adres en postcode wordt de oude en nieuwe waarde vergeleken zonder spaties, hoofdletters en leestekens (huisnummer + toevoeging worden ook aan elkaar geplakt). Zijn ze dan gelijk, dan is het een cosmetisch verschil.
2. **Label per groep.**
   - Alle adres-/postcodeverschillen cosmetisch → badge **Adrescorrectie** (neutrale, grijze badge) en knop **Correctie overnemen**.
   - Minstens één echt afwijkend adres of postcode → badge **Verhuizing** blijft staan, met knop **Verhuizing overnemen**.
3. **Gedrag ongewijzigd.** Overnemen en negeren blijven precies werken zoals nu, inclusief het meeverhuizen van de koppeling bij een echte verhuizing. Er wordt niets automatisch doorgevoerd of verborgen.

## Technisch
- `src/components/register/RegisterEnrichmentPanel.tsx`: `Group.isMove` wordt vervangen door `changeKind: "move" | "correction" | null`, bepaald met een genormaliseerde vergelijking van `current_value` en `proposed_value` van de adres-/postcodevoorstellen. Badge en knoptekst volgen dit veld.
- Normalisatie hergebruikt de bestaande helper-stijl uit `src/lib/registerLocationMatch.ts` / `src/lib/memberLocations.ts` (lowercase, alleen letters en cijfers).
- Alleen presentatie; geen wijzigingen in database, edge functions of `useResolveProposal`.
