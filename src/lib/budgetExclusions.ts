// Boekingen die buiten de begroting vallen (bv. betaling vanaf de verkeerde
// rekening door de penningmeester). Deze tellen niet mee in het budget,
// het dashboard of de harde check.
export const EXCLUDED_DOSSIER = "Buiten begroting (verkeerde rekening)";

export function isExcludedDossier(dossier?: string | null): boolean {
  return (dossier || "").toLowerCase().includes("buiten begroting");
}
