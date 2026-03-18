import type { Member } from "@/data/types";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import coffeeshopData from "@/data/coffeeshops-nl.json";

const StedenDekkingOverzicht = ({ members }: { members: Member[] }) => {
  const navigate = useNavigate();
  const totalNL = coffeeshopData.totaalNL;
  const perStad = coffeeshopData.perStad as Record<string, number>;
  const totalMembers = members.length;
  const totalLocaties = members.reduce((s, m) => s + (m.aantalLocaties || 1), 0);

  // Count BCD locations per city
  const cityCount: Record<string, number> = {};
  members.forEach((m) => {
    if (m.plaats) cityCount[m.plaats] = (cityCount[m.plaats] || 0) + (m.aantalLocaties || 1);
  });

  const marketPct = Math.round((totalLocaties / totalNL) * 100);

  // Top cities by total coffeeshops with BCD share
  const highlights = Object.entries(perStad)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([city, total]) => {
      const bcd = cityCount[city] || 0;
      const pct = total > 0 ? Math.round((bcd / total) * 100) : 0;
      return { city, total, bcd, pct };
    });

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display mb-1">Marktaandeel BCD</h3>
      <p className="text-xs text-muted-foreground mb-4">
        {totalMembers} van {totalNL} coffeeshops in NL · bron WODC 2024
      </p>

      {/* Overall market share */}
      <div className="mb-5">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">Landelijk</span>
          <span className="text-muted-foreground tabular-nums">
            {totalMembers}/{totalNL} · {marketPct}%
          </span>
        </div>
        <div className="h-4 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${marketPct}%` }}
          />
        </div>
      </div>

      {/* Per city highlights */}
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Top steden
      </h4>
      <div className="space-y-2">
        {highlights.map(({ city, total, bcd, pct }) => (
          <div key={city}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">{city}</span>
              <span className="tabular-nums">
                {bcd}/{total}{" "}
                <span className={pct > 30 ? "text-success font-medium" : "text-muted-foreground"}>
                  ({pct}%)
                </span>
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/70 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/marktaandeel")}
        className="mt-4 flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
      >
        Volledig overzicht <ArrowRight size={12} />
      </button>
    </div>
  );
};

export default StedenDekkingOverzicht;
