// Boekingen die buiten de begroting vallen (bv. betaling vanaf de verkeerde
// rekening door de penningmeester). Deze tellen niet mee in het budget,
// het dashboard of de harde check.
export const EXCLUDED_DOSSIER = "Buiten begroting (verkeerde rekening)";

export function isExcludedDossier(dossier?: string | null): boolean {
  return (dossier || "").toLowerCase().includes("buiten begroting");
}

// Automatisch aangemaakte "dossiers" voor contributiebetalingen van leden
// (bv. "Contributie #65 (2025107)"). Dit zijn geen werkdossiers en worden
// niet getoond in het dossieroverzicht.
export function isContributionDossier(dossier?: string | null): boolean {
  return /^\s*contributie\b/i.test(dossier || "");
}
