import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Member } from "@/data/types";

interface CityChartProps {
  members: Member[];
}

const CityChart = ({ members }: CityChartProps) => {
  const cityCount: Record<string, number> = {};
  members.forEach((m) => {
    if (m.plaats) cityCount[m.plaats] = (cityCount[m.plaats] || 0) + 1;
  });

  const data = Object.entries(cityCount)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display mb-4">Leden per Stad</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 80, right: 16 }}>
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="city" tick={{ fontSize: 12 }} width={80} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)", fontSize: 13 }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Leden">
              {data.map((_, i) => (
                <Cell key={i} fill={i === 0 ? "hsl(217, 91%, 53%)" : "hsl(217, 91%, 75%)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CityChart;
