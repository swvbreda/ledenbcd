/**
 * Eén gedeelde samenvatting van de centrale vertegenwoordigingscijfers
 * (public-stats / get_representation_stats). Alle dashboardrollen gebruiken
 * deze bron; lokale ledentellingen worden nooit als vervanging gebruikt.
 */
export type RepresentationInput = {
  isLoading: boolean;
  isError: boolean;
  fromRegister: boolean;
  perGemeente: Record<string, number>;
  representedPerGemeente: Record<string, number>;
  totaalNL: number;
  totaalRepresented: number;
};

export type RepresentationSummary =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ok";
      totaalRepresented: number;
      totaalNL: number;
      marketPct: number;
      gemeentenNL: number;
      gemeentenVertegenwoordigd: number;
      gemeentenPct: number;
      g4Represented: number;
      g4Total: number;
      g4Pct: number;
    };

export const G4 = ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht"];

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function summarizeRepresentation(s: RepresentationInput): RepresentationSummary {
  if (s.isLoading) return { status: "loading" };
  // Noodfallback (statisch bestand) of fout: niet als feit presenteren.
  if (s.isError || !s.fromRegister || !(s.totaalNL > 0)) return { status: "error" };
  const gemeentenNL = Object.values(s.perGemeente).filter((n) => n > 0).length;
  // Alleen vertegenwoordigde gemeenten die ook actieve landelijke gemeenten zijn.
  const gemeentenVertegenwoordigd = Object.entries(s.representedPerGemeente).filter(
    ([g, n]) => n > 0 && (s.perGemeente[g] || 0) > 0,
  ).length;
  const g4Total = G4.reduce((t, c) => t + (s.perGemeente[c] || 0), 0);
  const g4Represented = G4.reduce((t, c) => t + (s.representedPerGemeente[c] || 0), 0);
  return {
    status: "ok",
    totaalRepresented: s.totaalRepresented,
    totaalNL: s.totaalNL,
    marketPct: pct(s.totaalRepresented, s.totaalNL),
    gemeentenNL,
    gemeentenVertegenwoordigd,
    gemeentenPct: pct(gemeentenVertegenwoordigd, gemeentenNL),
    g4Represented,
    g4Total,
    g4Pct: pct(g4Represented, g4Total),
  };
}

/** Bankaggregaat: alleen aantallen per bankcode, nooit rekeningnummers. */
export type BankAggregateRow = { bank_code: string; aantal: number; totaal_leden: number };
