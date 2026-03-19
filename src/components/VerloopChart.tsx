import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import verloopData from "@/data/verloop.json";

const VerloopChart = () => {
  const data = Object.entries(verloopData).map(([year, count]) => ({
    year: Number(year),
    leden: count,
  }));

  const current = data[data.length - 1];
  const previous = data[data.length - 2];
  const fiveYearsAgo = data.find(d => d.year === current.year - 5) || data[0];

  const yoyGrowth = previous ? Math.round(((current.leden - previous.leden) / previous.leden) * 100) : 0;
  const yoyAbsolute = previous ? current.leden - previous.leden : 0;
  const fiveYrGrowth = Math.round(((current.leden - fiveYearsAgo.leden) / fiveYearsAgo.leden) * 100);

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex flex-col gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold font-display mb-1">Ledenverloop</h3>
          <p className="text-xs text-muted-foreground mb-4">Hoeveel huidige leden er per jaar al aangesloten waren</p>
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
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-muted/50 rounded-lg p-2.5 sm:p-4 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Huidig</p>
            <p className="text-xl sm:text-3xl font-bold font-display">{current.leden}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">leden in {current.year}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 sm:p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp size={12} className="text-green-600 sm:w-3.5 sm:h-3.5" />
              <p className="text-[10px] sm:text-xs text-muted-foreground">t.o.v. {previous?.year}</p>
            </div>
            <p className="text-xl sm:text-3xl font-bold font-display text-green-600">+{yoyGrowth}%</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">+{yoyAbsolute} leden</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 sm:p-4 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">5 jaar</p>
            <p className="text-xl sm:text-3xl font-bold font-display text-primary">+{fiveYrGrowth}%</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">+{current.leden - fiveYearsAgo.leden} leden</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerloopChart;
