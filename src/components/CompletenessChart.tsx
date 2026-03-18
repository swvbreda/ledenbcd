import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Member } from "@/data/types";

const CompletenessChart = ({ members }: { members: Member[] }) => {
  const fields = [
    { label: "Contactpersoon", check: (m: Member) => !!m.contactpersoon },
    { label: "Telefoon", check: (m: Member) => !!m.telefoon },
    { label: "Email", check: (m: Member) => !!m.email },
    { label: "Factuur Bedrijf", check: (m: Member) => !!m.factuurBedrijfsnaam },
    { label: "Factuur Email", check: (m: Member) => !!m.factuurEmail },
    { label: "Factuur Adres", check: (m: Member) => !!m.factuurAdres },
    { label: "KVK", check: (m: Member) => !!m.factuurKvk },
  ];

  const data = fields.map((f) => ({
    name: f.label,
    pct: Math.round((members.filter(f.check).length / members.length) * 100),
  }));

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display mb-4">Data Compleetheid (%)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 100, right: 16 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
            <Tooltip
              formatter={(v: number) => `${v}%`}
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 13 }}
            />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]} name="Compleet">
              {data.map((d, i) => (
                <Cell key={i} fill={d.pct >= 80 ? "hsl(160, 64%, 40%)" : d.pct >= 50 ? "hsl(32, 95%, 55%)" : "hsl(0, 84%, 60%)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CompletenessChart;
