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
  memberId: number;
  memberNaam: string;
  memberPlaats: string;
  locatieNaam?: string;
  jaren: number;
  oprichtingsDatum?: string;
  oprichtingJaar: number;
}

const JubileumOverzicht = ({ members }: { members: Member[] }) => {
  const navigate = useNavigate();

  const jubilea: JubileumEntry[] = [];
  const seen = new Set<string>(); // prevent duplicates

  members.forEach((m) => {
    // Check member-level oprichtingJaar / lidSinds
    const memberYear = m.oprichtingJaar || m.lidSinds;
    if (memberYear) {
      const jaren = CURRENT_YEAR - memberYear;
      if (JUBILEA.includes(jaren)) {
        const key = `member-${m.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          jubilea.push({
            memberId: m.id,
            memberNaam: m.naam,
            memberPlaats: m.plaats,
            jaren,
            oprichtingsDatum: m.oprichtingsDatum,
            oprichtingJaar: memberYear,
          });
        }
      }
    }

    // Check each location's oprichtingsDatum
    m.locaties?.forEach((loc) => {
      if (!loc.oprichtingsDatum) return;
      const locYear = new Date(loc.oprichtingsDatum).getFullYear();
      if (isNaN(locYear)) return;
      const jaren = CURRENT_YEAR - locYear;
      if (!JUBILEA.includes(jaren)) return;

      // Skip if same year as member-level jubilee (avoid duplicate)
      if (memberYear && CURRENT_YEAR - memberYear === jaren && !loc.naam) return;

      const key = `loc-${m.id}-${loc.naam}`;
      if (seen.has(key)) return;
      seen.add(key);

      // Only add if this location jubilee is different from the member-level one,
      // or if there was no member-level jubilee
      const memberJaren = memberYear ? CURRENT_YEAR - memberYear : null;
      if (memberJaren === jaren && m.locaties.length === 1) return; // single location = same as member

      jubilea.push({
        memberId: m.id,
        memberNaam: m.naam,
        memberPlaats: loc.plaats || m.plaats,
        locatieNaam: loc.naam,
        jaren,
        oprichtingsDatum: loc.oprichtingsDatum,
        oprichtingJaar: locYear,
      });
    });
  });

  jubilea.sort((a, b) => b.jaren - a.jaren);

  if (!jubilea.length) return null;

  const formatOprichting = (entry: JubileumEntry) => {
    if (entry.oprichtingsDatum) {
      try {
        const d = new Date(entry.oprichtingsDatum);
        return `Opgericht ${d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`;
      } catch {
        return `Opgericht ${entry.oprichtingsDatum}`;
      }
    }
    return `Opgericht in ${entry.oprichtingJaar}`;
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
          const colors = JUBILEE_COLORS[j.jaren] || { bg: "bg-primary/10", border: "border-primary/30", text: "text-primary", label: "" };
          const oprichtingText = formatOprichting(j);
          const displayName = j.locatieNaam || j.memberNaam;
          return (
            <button
              key={`${j.memberId}-${j.locatieNaam || "member"}-${i}`}
              onClick={() => navigate(`/leden/${j.memberId}`)}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
              title={colors.label ? `${colors.label} jubileum` : undefined}
            >
              <div className={`shrink-0 w-12 h-12 rounded-full ${colors.bg} border-2 ${colors.border} flex items-center justify-center`}>
                <span className={`text-sm font-bold ${colors.text}`}>{j.jaren}</span>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {oprichtingText} · {j.memberPlaats}
                </p>
                {j.locatieNaam && (
                  <p className="text-[10px] text-muted-foreground/70 truncate">
                    {j.memberNaam}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default JubileumOverzicht;
