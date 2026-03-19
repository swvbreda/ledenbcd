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
};

/** Get the gemeente for a given plaats */
export const getGemeente = (plaats: string): string =>
  plaatsToGemeente[plaats] || plaats;
