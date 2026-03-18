import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Line, ComposedChart } from "recharts";
import verloopDetail from "@/data/verloop-detail.json";

const InstroomUitstroomChart = () => {
  const data = verloopDetail.map((d) => ({
    year: d.year,
    instroom: d.instroom,
    uitstroom: -d.uitstroom,
    totaal: d.totaal,
  }));

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display mb-1">Instroom & Uitstroom</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Nieuwe leden (groen) en vertrokken leden (rood) per jaar, met totaal ledenaantal (lijn)
      </p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ left: 0, right: 16 }} stackOffset="sign">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                fontSize: 13,
              }}
              formatter={(value: number, name: string) => {
                if (name === "uitstroom") return [Math.abs(value), "Uitstroom"];
                if (name === "instroom") return [value, "Instroom"];
                return [value, "Totaal leden"];
              }}
            />
            <Bar dataKey="instroom" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} name="instroom" />
            <Bar dataKey="uitstroom" fill="hsl(0, 84%, 60%)" radius={[0, 0, 4, 4]} name="uitstroom" />
            <Line
              type="monotone"
              dataKey="totaal"
              stroke="hsl(217, 91%, 53%)"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(217, 91%, 53%)" }}
              name="totaal"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default InstroomUitstroomChart;
