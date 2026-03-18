import { useNavigate } from "react-router-dom";
import { Award } from "lucide-react";
import type { Member } from "@/data/types";

const JUBILEA = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const CURRENT_YEAR = 2026;

interface JubileumEntry {
  member: Member;
  type: "oprichting" | "lidmaatschap";
  jaren: number;
  sinds: number;
}

const JubileumOverzicht = ({ members }: { members: Member[] }) => {
  const navigate = useNavigate();

  const jubilea: JubileumEntry[] = [];

  members.forEach((m) => {
    if (m.oprichtingJaar) {
      const jaren = CURRENT_YEAR - m.oprichtingJaar;
      if (JUBILEA.includes(jaren)) {
        jubilea.push({ member: m, type: "oprichting", jaren, sinds: m.oprichtingJaar });
      }
    }
    if (m.lidSinds) {
      const jaren = CURRENT_YEAR - m.lidSinds;
      if (JUBILEA.includes(jaren)) {
        jubilea.push({ member: m, type: "lidmaatschap", jaren, sinds: m.lidSinds });
      }
    }
  });

  jubilea.sort((a, b) => b.jaren - a.jaren);

  if (!jubilea.length) return null;

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
        {jubilea.map((j, i) => (
          <button
            key={`${j.member.id}-${j.type}-${i}`}
            onClick={() => navigate(`/leden/${j.member.id}`)}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
          >
            <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{j.jaren}</span>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{j.member.naam}</p>
              <p className="text-xs text-muted-foreground">
                {j.type === "oprichting" ? "Opgericht" : "BCD-lid"} sinds {j.sinds} · {j.member.plaats}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default JubileumOverzicht;
