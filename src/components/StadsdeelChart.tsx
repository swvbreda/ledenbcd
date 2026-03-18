import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { Member } from "@/data/types";

const COLORS = [
  "hsl(217, 91%, 53%)",
  "hsl(160, 64%, 40%)",
  "hsl(32, 95%, 55%)",
  "hsl(350, 70%, 55%)",
  "hsl(270, 50%, 55%)",
  "hsl(190, 70%, 45%)",
];

const StadsdeelChart = ({ members }: { members: Member[] }) => {
  const counts: Record<string, number> = {};
  members.forEach((m) => {
    m.locaties.forEach((l) => {
      if (l.stadsdeel) counts[l.stadsdeel] = (counts[l.stadsdeel] || 0) + 1;
    });
  });

  const data = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display mb-4">Locaties per Stadsdeel</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)", fontSize: 13 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StadsdeelChart;
