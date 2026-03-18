import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import verloopData from "@/data/verloop.json";

const VerloopChart = () => {
  const data = Object.entries(verloopData).map(([year, count]) => ({
    year: Number(year),
    leden: count,
  }));

  return (
    <div className="bg-card rounded-lg border border-border p-5">
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
  );
};

export default VerloopChart;
