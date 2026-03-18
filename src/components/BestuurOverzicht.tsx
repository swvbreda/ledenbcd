import { Shield, Mail, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Member } from "@/data/types";

interface BestuurOverzichtProps {
  members: Member[];
}

const bestuursleden: { naam: string; functie: string; lidId?: number; email?: string; telefoon?: string }[] = [
  { naam: "Simone van Breda", functie: "Voorzitter", email: "simone@coffeeshopbond.nl", telefoon: "06 868 752 31" },
  { naam: "Joachim Helms", functie: "Bestuurder / Woordvoerder", lidId: 5 },
  { naam: "Bernard van Nierop", functie: "Bestuurder / Penningmeester", lidId: 8 },
  { naam: "Huub van den Brink", functie: "Bestuurder", lidId: 4 },
  { naam: "Dorine Buchener", functie: "Bestuurder", lidId: 21 },
  { naam: "Stef Couwenberg", functie: "Bestuurder", lidId: 14 },
];

const BestuurOverzicht = ({ members }: BestuurOverzichtProps) => {
  const navigate = useNavigate();

  const getContact = (bl: typeof bestuursleden[0], member?: Member) => {
    if (bl.email || bl.telefoon) return { email: bl.email, telefoon: bl.telefoon };
    if (!member) return {};
    // Find the matching contact person in the member's contacts
    const contact = member.contacten.find(
      (c) => bl.naam.includes(c.naam) || c.naam.includes(bl.naam.split(" ").pop() || "")
    );
    if (contact) return { email: contact.email, telefoon: contact.telefoon };
    return { email: member.email, telefoon: member.telefoon };
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
        <Shield size={16} className="text-primary" />
        Bestuur BCD
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {bestuursleden.map((bl) => {
          const member = bl.lidId ? members.find((m) => m.id === bl.lidId) : undefined;
          const contact = getContact(bl, member);
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
                <p className="text-xs text-primary mt-1.5">{member.naam}</p>
              )}
              <div className="mt-2 space-y-0.5">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Mail size={11} /> {contact.email}
                  </a>
                )}
                {contact.telefoon && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone size={11} /> {contact.telefoon}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BestuurOverzicht;
