/** Maps plaats names to their parent gemeente when they differ */
export const plaatsToGemeente: Record<string, string> = {
  "Wormerveer": "Zaanstad",
  "Zaandam": "Zaanstad",
  "Wormer": "Zaanstad",
  "Krommenie": "Zaanstad",
  "Assendelft": "Zaanstad",
  "Hellevoetsluis": "Voorne aan Zee",
  "Brielle": "Voorne aan Zee",
  "Westvoorne": "Voorne aan Zee",
  "Hoogezand": "Midden-Groningen",
  "Bussum": "Gooise Meren",
  "Driebergen": "Utrechtse Heuvelrug",
  "Driebergen-Rijsenburg": "Utrechtse Heuvelrug",
  "Mijdrecht": "De Ronde Venen",
  "Steenwijk": "Steenwijkerland",
};

/** Get the gemeente for a given plaats */
export const getGemeente = (plaats: string): string =>
  plaatsToGemeente[plaats] || plaats;

/** Prefer a stored municipality on a location; fall back to deriving it from the place. */
export const getLocationGemeente = (
  locatie: { gemeente?: string | null; plaats?: string | null },
  fallbackPlaats?: string | null,
): string => {
  const explicit = locatie.gemeente?.trim();
  if (explicit) return explicit;
  return getGemeente((locatie.plaats || fallbackPlaats || "").trim());
};

/** Aggregate a per-plaats record into per-gemeente totals */
export function aggregateByGemeente(perPlaats: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [plaats, count] of Object.entries(perPlaats)) {
    const gemeente = getGemeente(plaats);
    result[gemeente] = (result[gemeente] || 0) + count;
  }
  return result;
}
