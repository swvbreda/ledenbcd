import { useNavigate } from "react-router-dom";
import { Award } from "lucide-react";
import type { Member } from "@/data/types";

const JUBILEA = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const CURRENT_YEAR = new Date().getFullYear();

// Official Dutch jubilee colors
const JUBILEE_COLORS: Record<number, { bg: string; border: string; text: string; label: string }> = {
  5:  { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-700", label: "Houten" },
  10: { bg: "bg-orange-100",  border: "border-orange-300",  text: "text-orange-700",  label: "Koperen" },
  15: { bg: "bg-indigo-100",  border: "border-indigo-300",  text: "text-indigo-600",  label: "Kristallen" },
  20: { bg: "bg-sky-100",     border: "border-sky-300",     text: "text-sky-700",     label: "Porseleinen" },
  25: { bg: "bg-slate-200",   border: "border-slate-400",   text: "text-slate-600",   label: "Zilveren" },
  30: { bg: "bg-amber-100",   border: "border-amber-300",   text: "text-amber-700",   label: "Parelen" },
  35: { bg: "bg-red-100",     border: "border-red-300",     text: "text-red-700",     label: "Koralen" },
  40: { bg: "bg-rose-100",    border: "border-rose-300",    text: "text-rose-700",    label: "Robijnen" },
  45: { bg: "bg-violet-100",  border: "border-violet-300",  text: "text-violet-700",  label: "Saffieren" },
  50: { bg: "bg-yellow-100",  border: "border-yellow-400",  text: "text-yellow-700",  label: "Gouden" },
};

interface JubileumEntry {
  member: Member;
  jaren: number;
}

const JubileumOverzicht = ({ members }: { members: Member[] }) => {
  const navigate = useNavigate();

  const jubilea: JubileumEntry[] = [];

  members.forEach((m) => {
    // Use oprichtingJaar primarily; fall back to lidSinds
    const referenceYear = m.oprichtingJaar || m.lidSinds;
    if (referenceYear) {
      const jaren = CURRENT_YEAR - referenceYear;
      if (JUBILEA.includes(jaren)) {
        jubilea.push({ member: m, jaren });
      }
    }
  });

  jubilea.sort((a, b) => b.jaren - a.jaren);

  if (!jubilea.length) return null;

  const formatOprichting = (m: Member) => {
    if (m.oprichtingsDatum) {
      try {
        const d = new Date(m.oprichtingsDatum);
        return `Opgericht ${d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`;
      } catch {
        return `Opgericht ${m.oprichtingsDatum}`;
      }
    }
    if (m.oprichtingJaar) return `Opgericht in ${m.oprichtingJaar}`;
    return null;
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <Award size={18} className="text-primary" />
        <h3 className="text-sm font-semibold font-display">Jubilea in {CURRENT_YEAR}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Coffeeshops met een bijzonder jubileum dit jaar
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {jubilea.map((j, i) => {
          const colors = JUBILEE_COLORS[j.jaren] || { bg: "bg-primary/10", text: "text-primary" };
          const oprichtingText = formatOprichting(j.member);
          return (
            <button
              key={`${j.member.id}-${i}`}
              onClick={() => navigate(`/leden/${j.member.id}`)}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              <div className={`shrink-0 w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center`}>
                <span className={`text-sm font-bold ${colors.text}`}>{j.jaren}</span>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{j.member.naam}</p>
                <p className="text-xs text-muted-foreground">
                  {oprichtingText && <>{oprichtingText} · </>}{j.member.plaats}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default JubileumOverzicht;
