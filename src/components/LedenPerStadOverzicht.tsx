import type { Member } from "@/data/types";

const LedenPerStadOverzicht = ({ members }: { members: Member[] }) => {
  const cityCount: Record<string, number> = {};
  members.forEach((m) => {
    if (m.plaats) cityCount[m.plaats] = (cityCount[m.plaats] || 0) + 1;
  });

  const sorted = Object.entries(cityCount)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);

  const max = sorted[0]?.count || 1;

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display mb-1">Leden per Stad</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Alle {sorted.length} steden waar onze leden gevestigd zijn
      </p>
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-2">
        {sorted.map(({ city, count }) => (
          <div key={city} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 text-right text-muted-foreground truncate" title={city}>
              {city}
            </span>
            <div className="flex-1 h-6 bg-muted rounded-sm overflow-hidden">
              <div
                className="h-full bg-primary rounded-sm transition-all"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right font-medium tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LedenPerStadOverzicht;
