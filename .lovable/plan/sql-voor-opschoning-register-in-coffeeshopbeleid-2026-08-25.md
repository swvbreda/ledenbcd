# SQL voor opschoning register in "Coffeeshopbeleid"

Deze SQL trekt de plaatsnamen in het bronregister gelijk, precies zoals hier al is gedaan. Je voert hem uit in het project Coffeeshopbeleid (chat daar openen en de SQL laten uitvoeren als datawijziging).

## Aanname over het bronschema

De koppeling leest uit tabel `public.coffeeshop_vergunningen` (kolommen o.a. `plaats`, `gemeente_id`) en `public.gemeenten` (`id`, `naam`, `provincie`). Kloppen die namen daar niet, dan moeten de tabelnamen in de SQL worden aangepast — dat kan pas zeker worden vastgesteld in dat project zelf.

## Stap 1 — eerst kijken wat er scheef staat (leesquery)

```sql
SELECT COUNT(*) AS totaal,
       COUNT(*) FILTER (WHERE plaats IS NULL OR btrim(plaats) = '') AS zonder_plaats,
       COUNT(*) FILTER (WHERE plaats ~ '[‘’´]') AS krulapostrof,
       COUNT(*) FILTER (WHERE plaats ~ '\([A-Za-z.\s]+\)\s*$') AS met_suffix
FROM public.coffeeshop_vergunningen;
```

## Stap 2 — opschonen (datawijziging)

```sql
-- 1. Krulapostrofs rechtzetten en toevoegingen als "(O.)" / "(Z.)" strippen
UPDATE public.coffeeshop_vergunningen
SET plaats = nullif(
      btrim(regexp_replace(
        replace(replace(replace(coalesce(plaats,''), '‘',''''), '’',''''), '´',''''),
        '\s*\([A-Za-z.\s]+\)\s*$', '')), '');

UPDATE public.gemeenten
SET naam = btrim(regexp_replace(
      replace(replace(replace(coalesce(naam,''), '‘',''''), '’',''''), '´',''''),
      '\s*\([A-Za-z.\s]+\)\s*$', ''));

-- 2. Dubbele schrijfwijzen samenvoegen
UPDATE public.coffeeshop_vergunningen
SET plaats = 'Den Haag'
WHERE lower(plaats) IN ('''s-gravenhage', 's-gravenhage');

UPDATE public.gemeenten
SET naam = 'Den Haag'
WHERE lower(naam) IN ('''s-gravenhage', 's-gravenhage');

UPDATE public.coffeeshop_vergunningen
SET plaats = '''s-Hertogenbosch'
WHERE lower(plaats) IN ('''s-hertogenbosch', 's-hertogenbosch', 'den bosch');

UPDATE public.gemeenten
SET naam = '''s-Hertogenbosch'
WHERE lower(naam) IN ('''s-hertogenbosch', 's-hertogenbosch', 'den bosch');

-- 3. Ontbrekende plaatsnaam aanvullen met de gemeentenaam
UPDATE public.coffeeshop_vergunningen v
SET plaats = g.naam
FROM public.gemeenten g
WHERE v.gemeente_id = g.id
  AND (v.plaats IS NULL OR btrim(v.plaats) = '')
  AND g.naam IS NOT NULL AND btrim(g.naam) <> '';
```

Let op: als `gemeenten.naam` uniek geïndexeerd is, kan het samenvoegen van 's-Gravenhage naar Den Haag botsen met een bestaande rij "Den Haag". In dat geval moeten de shops eerst naar de bestaande gemeenterij worden verhangen en de dubbele gemeenterij daarna worden verwijderd; dat is in dat project met één blik op de data te bepalen.

## Stap 3 — controleren

```sql
SELECT plaats, COUNT(*) FROM public.coffeeshop_vergunningen GROUP BY 1 ORDER BY 2 DESC, 1;
```

Verwacht: 601 rijen totaal, geen lege plaatsnamen, geen dubbele schrijfwijzen.

## Daarna in dit project

Niets extra nodig: de dagelijkse sync (en de knop "Register synchroniseren") normaliseert al dezelfde schrijfwijzen, dus het register hier blijft schoon en de landelijke statistiek blijft op 601 staan.
