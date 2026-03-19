/** Maps specific stadsdeel names to broad directional categories */
const stadsdeelMapping: Record<string, string> = {
  "Apeldoorn-Noordoost": "Noord",
  "Binnenstad": "Centrum",
  "Bussum-Zuid": "Zuid",
  "Centrum": "Centrum",
  "Delfshaven": "West",
  "Hellevoetsluis": "Overig",
  "Hoogezand": "Overig",
  "Hoorn-Noord": "Noord",
  "Korvel": "Zuid",
  "Kralingen-Crooswijk": "Oost",
  "Laakkwartier en Spoorwijk": "West",
  "Nieuw Ginneken": "Zuid",
  "Nieuw West": "West",
  "Nijmegen-Oost": "Oost",
  "Noord": "Noord",
  "Oost": "Oost",
  "Overdie": "Overig",
  "Regentessekwartier": "West",
  "Spijkerkwartier": "Oost",
  "Stratum": "Zuid",
  "Vlaardingen Centrum": "Centrum",
  "West": "West",
  "Woerden-Oost": "Oost",
  "Wormerveer-Noord": "Noord",
  "Zandweerd": "Overig",
  "Zuid": "Zuid",
};

export const stadsdeelCategorieen = ["Centrum", "Noord", "Oost", "West", "Zuid", "Overig"] as const;

export function getStadsdeelCategorie(stadsdeel: string): string {
  return stadsdeelMapping[stadsdeel] || "Overig";
}
