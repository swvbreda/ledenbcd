import { useState } from "react";
import { Check, X, Clock, ChevronDown, ChevronUp, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  useEditRequests,
  useApproveEditRequest,
  useRejectEditRequest,
  type EditRequest,
} from "@/hooks/useMemberEdits";
import { allMembersAndLeads } from "@/hooks/useMembers";
import type { Member } from "@/data/types";

const fieldLabels: Record<string, string> = {
  naam: "Naam",
  plaats: "Plaats",
  bedrijfsnaam: "Bedrijfsnaam",
  kvk: "KVK",
  website: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  oprichtingJaar: "Oprichtingsjaar",
  lidSinds: "Lid sinds",
  factuurBedrijfsnaam: "Factuur bedrijfsnaam",
  factuurKvk: "Factuur KVK",
  factuurAdres: "Factuur adres",
  factuurPostcode: "Factuur postcode",
  factuurPlaats: "Factuur plaats",
  factuurEmail: "Factuur e-mail",
  factuurTelefoon: "Factuur telefoon",
  aantalLocaties: "Aantal locaties",
  contacten: "Contactpersonen",
  locaties: "Locaties",
};

function ChangeSummary({ data, member }: { data: Partial<Member>; member?: Member }) {
  const entries = Object.entries(data).filter(
    ([key]) => key !== "aantalLocaties"
  );

  return (
    <div className="space-y-2 text-sm">
      {entries.map(([key, newVal]) => {
        const label = fieldLabels[key] || key;
        const oldVal = member ? (member as any)[key] : undefined;

        if (key === "locaties" && Array.isArray(newVal)) {
          return (
            <div key={key}>
              <span className="font-medium text-muted-foreground">{label}:</span>
              <div className="ml-3 mt-1 space-y-1">
                {(newVal as any[]).map((loc, i) => (
                  <div key={i} className="text-xs bg-muted/50 rounded px-2 py-1">
                    {loc.naam} — {loc.plaats || "?"}, {loc.adres || ""}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (key === "contacten" && Array.isArray(newVal)) {
          return (
            <div key={key}>
              <span className="font-medium text-muted-foreground">{label}:</span>
              <div className="ml-3 mt-1 space-y-1">
                {(newVal as any[]).map((c, i) => (
                  <div key={i} className="text-xs bg-muted/50 rounded px-2 py-1">
                    {c.naam} ({c.functie}) — {c.email}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const oldStr = oldVal != null ? String(oldVal) : "—";
        const newStr = newVal != null ? String(newVal) : "—";
        const changed = oldStr !== newStr;

        return (
          <div key={key} className="flex items-baseline gap-2">
            <span className="font-medium text-muted-foreground">{label}:</span>
            {changed && member ? (
              <>
                <span className="line-through text-muted-foreground/60">{oldStr}</span>
                <span className="text-foreground">→ {newStr}</span>
              </>
            ) : (
              <span>{newStr}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RequestCard({ request }: { request: EditRequest }) {
  const [expanded, setExpanded] = useState(true);
  const member = allMembersAndLeads.find((m) => m.id === request.member_id);
  const approveMutation = useApproveEditRequest();
  const rejectMutation = useRejectEditRequest();

  const handleApprove = () => {
    approveMutation.mutate(
      { request },
      {
        onSuccess: () => toast.success("Wijziging goedgekeurd en verwerkt"),
        onError: (err) => toast.error("Fout: " + (err as Error).message),
      }
    );
  };

  const handleReject = () => {
    rejectMutation.mutate(
      { requestId: request.id },
      {
        onSuccess: () => toast.success("Wijziging afgewezen"),
        onError: (err) => toast.error("Fout: " + (err as Error).message),
      }
    );
  };

  const isPending = request.status === "pending";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold font-display">
              {member?.naam || `Lid #${request.member_id}`}
            </span>
            <Badge
              variant={
                request.status === "approved"
                  ? "default"
                  : request.status === "rejected"
                  ? "destructive"
                  : "secondary"
              }
            >
              {request.status === "pending"
                ? "In afwachting"
                : request.status === "approved"
                ? "Goedgekeurd"
                : "Afgewezen"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(request.created_at).toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-border pt-3">
          <ChangeSummary data={request.data} member={member} />
        </div>
      )}

      {isPending && (
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={approveMutation.isPending}
            className="gap-1.5"
          >
            <Check size={14} />{" "}
            {approveMutation.isPending ? "Verwerken..." : "Goedkeuren"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            disabled={rejectMutation.isPending}
            className="gap-1.5 text-destructive"
          >
            <X size={14} /> Afwijzen
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function GoedkeuringenPage() {
  const { isAdmin } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const { data: requests, isLoading } = useEditRequests(showAll ? "all" : "pending");

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Alleen het bestuur heeft toegang tot deze pagina.
      </div>
    );
  }

  const pendingCount = requests?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display">Goedkeuringen</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pendingCount > 0
              ? `${pendingCount} wijziging${pendingCount === 1 ? "" : "en"} wacht${pendingCount === 1 ? "" : "en"} op goedkeuring`
              : "Geen openstaande wijzigingen"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Alleen openstaand" : "Toon alles"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Laden...</div>
      ) : requests && requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <Clock size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">
            {showAll ? "Nog geen wijzigingsverzoeken" : "Geen openstaande verzoeken"}
          </p>
        </div>
      )}
    </div>
  );
}
