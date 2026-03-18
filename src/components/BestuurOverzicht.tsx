import { Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Member } from "@/data/types";

interface BestuurOverzichtProps {
  members: Member[];
}

const bestuursleden: { naam: string; functie: string; lidId?: number }[] = [
  { naam: "Simone van Breda", functie: "Voorzitter" },
  { naam: "Joachim Helms", functie: "Bestuurder / Woordvoerder", lidId: 5 },
  { naam: "Bernard van Nierop", functie: "Bestuurder / Penningmeester", lidId: 8 },
  { naam: "Huub van den Brink", functie: "Bestuurder", lidId: 4 },
  { naam: "Dorine Buchener", functie: "Bestuurder", lidId: 21 },
  { naam: "Stef Couwenberg", functie: "Bestuurder", lidId: 14 },
];

const BestuurOverzicht = ({ members }: BestuurOverzichtProps) => {
  const navigate = useNavigate();

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
        <Shield size={16} className="text-primary" />
        Bestuur BCD
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {bestuursleden.map((bl) => {
          const member = bl.lidId ? members.find((m) => m.id === bl.lidId) : undefined;
          return (
            <div
              key={bl.naam}
              className={`border border-border rounded-md p-3 transition-colors ${
                member ? "hover:bg-muted/30 cursor-pointer" : ""
              }`}
              onClick={() => member && navigate(`/leden/${member.id}`)}
            >
              <p className="font-medium text-sm">{bl.naam}</p>
              <p className="text-xs text-muted-foreground">{bl.functie}</p>
              {member && (
                <p className="text-xs text-primary mt-1">{member.naam}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BestuurOverzicht;
