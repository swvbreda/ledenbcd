import verloopData from "@/data/verloop.json";

const periods = [
  { label: "Eerste registratie", range: "2005", start: 2005, end: 2005 },
  { label: "Groei", range: "2006–2010", start: 2006, end: 2010 },
  { label: "Stabiel", range: "2011–2015", start: 2011, end: 2015 },
  { label: "Groei", range: "2016–2020", start: 2016, end: 2020 },
  { label: "Versnelling", range: "2021–2026", start: 2021, end: 2026 },
];

const LidmaatschapsduurChart = () => {
  const entries = Object.entries(verloopData).map(([y, c]) => ({ year: Number(y), count: c as number }));
  const current = entries[entries.length - 1]?.count || 0;
  const first = entries[0]?.count || 0;

  const bars = periods.map((p) => {
    const endVal = entries.find((e) => e.year === p.end)?.count || 0;
    const prevVal = p.start === 2005 ? 0 : entries.find((e) => e.year === p.start - 1)?.count || 0;
    return { ...p, added: endVal - prevVal, endVal };
  });

  const maxAdded = Math.max(...bars.map((b) => b.added));

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display mb-1">Ledengroei per periode</h3>
      <p className="text-xs text-muted-foreground mb-4">
        BCD opgericht in 1994 · Van {first} naar {current} leden geregistreerd sinds 2005
      </p>

      <div className="space-y-3">
        {bars.map((b) => {
          const pct = maxAdded > 0 ? (b.added / maxAdded) * 100 : 0;
          return (
            <div key={b.range}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{b.range}</span>
                  <span className="text-muted-foreground">{b.label}</span>
                </div>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="text-success font-medium">+{b.added}</span>
                  <span className="text-muted-foreground">→ {b.endVal}</span>
                </div>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Current year highlight */}
      <div className="mt-4 p-3 bg-muted/30 rounded-lg flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Meeste groei in</span>
        <span className="text-sm font-semibold font-display">
          {bars.reduce((max, b) => (b.added > max.added ? b : max), bars[0]).range}
        </span>
      </div>
    </div>
  );
};

export default LidmaatschapsduurChart;
