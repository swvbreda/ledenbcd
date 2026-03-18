import type { Member } from "@/data/types";

const groups = [
  { label: "G4", cities: ["Amsterdam", "Rotterdam", "Den Haag", "'s-Gravenhage", "Utrecht"] },
  { label: "G40 (overig)", cities: ["Eindhoven", "Tilburg", "Groningen", "Almere", "Breda", "Nijmegen", "Arnhem", "Haarlem", "Enschede", "Haarlemmermeer", "Amersfoort", "Apeldoorn", "Zaanstad", "Zwolle", "Leiden", "Leeuwarden", "Maastricht", "Dordrecht", "Zoetermeer", "Emmen", "Westland", "Ede", "Venlo", "Delft", "Deventer", "Sittard-Geleen", "Helmond", "Oss", "Hilversum", "Heerlen", "Roosendaal", "Vlaardingen", "Gouda", "Alkmaar", "Schiedam", "Lelystad"] },
];

const highlights = [
  "Amsterdam",
  "Rotterdam",
  "Den Haag",
  "Utrecht",
  "Eindhoven",
  "Groningen",
  "Tilburg",
  "Haarlem",
  "Breda",
  "Maastricht",
];

const StedenDekkingOverzicht = ({ members }: { members: Member[] }) => {
  const total = members.length;

  const cityCount: Record<string, number> = {};
  members.forEach((m) => {
    if (m.plaats) cityCount[m.plaats] = (cityCount[m.plaats] || 0) + 1;
  });

  const getGroupCount = (cities: string[]) => {
    return Object.entries(cityCount)
      .filter(([city]) => cities.some((c) => city.toLowerCase().includes(c.toLowerCase())))
      .reduce((sum, [, count]) => sum + count, 0);
  };

  const g4Count = getGroupCount(groups[0].cities);
  const g40OverigCount = getGroupCount(groups[1].cities);
  const g4Pct = Math.round((g4Count / total) * 100);
  const g40Pct = Math.round(((g4Count + g40OverigCount) / total) * 100);
  const overigCount = total - g4Count - g40OverigCount;
  const overigPct = Math.round((overigCount / total) * 100);

  const highlightData = highlights.map((city) => {
    const count = Object.entries(cityCount)
      .filter(([c]) => c.toLowerCase() === city.toLowerCase())
      .reduce((sum, [, n]) => sum + n, 0);
    return { city, count, pct: Math.round((count / total) * 100) };
  }).filter((d) => d.count > 0);

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display mb-1">Dekking per regio</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Percentage van {total} leden per stedengroep
      </p>

      <div className="space-y-3 mb-5">
        {[
          { label: "G4", count: g4Count, pct: g4Pct, color: "bg-primary" },
          { label: "G40 (incl. G4)", count: g4Count + g40OverigCount, pct: g40Pct, color: "bg-primary/70" },
          { label: "Overige steden", count: overigCount, pct: overigPct, color: "bg-muted-foreground/40" },
        ].map((row) => (
          <div key={row.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{row.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {row.count} leden · {row.pct}%
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className={`h-full ${row.color} rounded-full transition-all`} style={{ width: `${row.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Per stad
      </h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {highlightData.map(({ city, count, pct }) => (
          <div key={city} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{city}</span>
            <span className="font-medium tabular-nums">{count} <span className="text-muted-foreground text-xs">({pct}%)</span></span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StedenDekkingOverzicht;
