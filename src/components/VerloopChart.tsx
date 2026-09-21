import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import type { Member } from "@/data/types";
import { buildVerloopSeries } from "@/lib/verloop";

interface VerloopChartProps {
  members?: Member[];
}

const VerloopChart = ({ members = [] }: VerloopChartProps) => {
  const { current, data, reliable } = buildVerloopSeries(members);
  const currentYear = new Date().getFullYear();

  const previous = data.length > 1 ? data[data.length - 2] : null;
  const fiveYearsAgo = data.find((d) => d.year === currentYear - 5) ?? null;

  const yoyAbsolute = previous ? current - previous.leden : null;
  const yoyGrowth = previous && previous.leden > 0 ? Math.round(((current - previous.leden) / previous.leden) * 100) : null;
  const fiveYrGrowth =
    fiveYearsAgo && fiveYearsAgo.leden > 0
      ? Math.round(((current - fiveYearsAgo.leden) / fiveYearsAgo.leden) * 100)
      : null;

  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex flex-col gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold font-display mb-1">Ledenverloop</h3>
          <p className="text-xs text-muted-foreground mb-4">
            {reliable
              ? "Hoeveel van de huidige leden er per jaar al aangesloten waren"
              : "Historie niet beschikbaar voor deze weergave"}
          </p>
          {reliable ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      fontSize: 13,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="leden"
                    stroke="hsl(217, 91%, 53%)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(217, 91%, 53%)" }}
                    name="Leden"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center rounded-lg bg-muted/40 px-4 text-center">
              <p className="text-xs text-muted-foreground">
                Het verloop wordt pas getoond zodra van de zichtbare leden voldoende startjaren bekend zijn.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-muted/50 rounded-lg p-2.5 sm:p-4 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Huidig</p>
            <p className="text-xl sm:text-3xl font-bold font-display tabular-nums">{current}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">leden in {currentYear}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 sm:p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp size={12} className="text-green-600 sm:w-3.5 sm:h-3.5" />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {previous ? `t.o.v. ${previous.year}` : "t.o.v. vorig jaar"}
              </p>
            </div>
            <p className="text-xl sm:text-3xl font-bold font-display text-green-600 tabular-nums">
              {yoyGrowth === null ? "–" : `${fmt(yoyGrowth)}%`}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {yoyAbsolute === null ? "geen historie" : `${fmt(yoyAbsolute)} leden`}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 sm:p-4 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">5 jaar</p>
            <p className="text-xl sm:text-3xl font-bold font-display text-success tabular-nums">
              {fiveYrGrowth === null ? "–" : `${fmt(fiveYrGrowth)}%`}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {fiveYearsAgo === null ? "geen historie" : `${fmt(current - fiveYearsAgo.leden)} leden`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerloopChart;
