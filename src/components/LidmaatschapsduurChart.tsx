import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Member } from "@/data/types";

const LidmaatschapsduurChart = ({ members }: { members: Member[] }) => {
  const buckets = [
    { label: "< 5 jaar", min: 0, max: 4 },
    { label: "5-10 jaar", min: 5, max: 10 },
    { label: "10-15 jaar", min: 11, max: 15 },
    { label: "15-20 jaar", min: 16, max: 20 },
    { label: "20+ jaar", min: 21, max: 999 },
  ];

  const data = buckets.map((b) => ({
    name: b.label,
    count: members.filter((m) => m.jarenLid !== null && m.jarenLid >= b.min && m.jarenLid <= b.max).length,
  }));

  const total = members.filter((m) => m.jarenLid !== null).length;
  const avg = total
    ? Math.round(members.filter((m) => m.jarenLid !== null).reduce((s, m) => s + (m.jarenLid || 0), 0) / total)
    : 0;

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display mb-1">Hoe lang zijn leden al lid?</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Gemiddeld {avg} jaar · {total} leden met data
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 16 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 13 }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Leden">
              {data.map((_, i) => (
                <Cell key={i} fill={`hsl(217, 91%, ${53 + i * 5}%)`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LidmaatschapsduurChart;
