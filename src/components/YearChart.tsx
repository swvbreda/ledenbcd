import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Member } from "@/data/types";

const YearChart = ({ members }: { members: Member[] }) => {
  const buckets = [
    { label: "< 5 jr", min: 0, max: 4 },
    { label: "5-10 jr", min: 5, max: 10 },
    { label: "10-20 jr", min: 11, max: 20 },
    { label: "20-30 jr", min: 21, max: 30 },
    { label: "30-40 jr", min: 31, max: 40 },
    { label: "40+ jr", min: 41, max: 999 },
  ];

  const data = buckets.map((b) => ({
    name: b.label,
    count: members.filter((m) => m.jarenLid !== null && m.jarenLid >= b.min && m.jarenLid <= b.max).length,
  }));

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display mb-4">Lidmaatschapsduur Verdeling</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 16 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 13 }}
            />
            <Bar dataKey="count" fill="hsl(217, 91%, 53%)" radius={[4, 4, 0, 0]} name="Leden" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default YearChart;
