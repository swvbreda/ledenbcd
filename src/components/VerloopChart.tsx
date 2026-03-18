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
  const first = data[0];

  const yoyGrowth = previous ? Math.round(((current.leden - previous.leden) / previous.leden) * 100) : 0;
  const yoyAbsolute = previous ? current.leden - previous.leden : 0;
  const totalGrowth = Math.round(((current.leden - first.leden) / first.leden) * 100);

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex flex-col gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold font-display mb-1">Ledenverloop</h3>
          <p className="text-xs text-muted-foreground mb-4">Aantal huidige leden dat al lid was per jaar</p>
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

        <div className="xl:w-52 shrink-0 flex xl:flex-col gap-4 xl:justify-center">
          <div className="flex-1 bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Huidig</p>
            <p className="text-3xl font-bold font-display">{current.leden}</p>
            <p className="text-xs text-muted-foreground">leden in {current.year}</p>
          </div>
          <div className="flex-1 bg-muted/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp size={14} className="text-green-600" />
              <p className="text-xs text-muted-foreground">t.o.v. {previous?.year}</p>
            </div>
            <p className="text-3xl font-bold font-display text-green-600">+{yoyGrowth}%</p>
            <p className="text-xs text-muted-foreground">+{yoyAbsolute} leden</p>
          </div>
          <div className="flex-1 bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Sinds {first.year}</p>
            <p className="text-3xl font-bold font-display text-primary">+{totalGrowth}%</p>
            <p className="text-xs text-muted-foreground">+{current.leden - first.leden} leden</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerloopChart;
