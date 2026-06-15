import { useState } from "react";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { Check, X, Clock, ChevronDown, ChevronUp, User, Mail, Phone, MapPin, Store, UserPlus } from "lucide-react";
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
import {
  useMembershipRequests,
  useUpdateMembershipRequest,
  type MembershipRequest,
} from "@/hooks/useMembershipRequests";
import { useMembersData } from "@/contexts/MembersDataContext";
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
  const entries = Object.entries(data).filter(([key, newVal]) => {
    if (key === "aantalLocaties") return false;
    if (!member) return true;
    const oldVal = (member as any)[key];
    if (Array.isArray(newVal) || Array.isArray(oldVal)) {
      return JSON.stringify(newVal) !== JSON.stringify(oldVal);
    }
    return String(newVal ?? "") !== String(oldVal ?? "");
  });

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Geen wijzigingen gevonden.</p>;
  }

  return (
    <div className="space-y-2 text-sm">
      {entries.map(([key, newVal]) => {
        const label = fieldLabels[key] || key;
        const oldVal = member ? (member as any)[key] : undefined;

        if (key === "locaties" && Array.isArray(newVal)) {
          const oldLocs = (member?.locaties || []) as any[];
          return (
            <div key={key}>
              <span className="font-medium text-muted-foreground">{label}:</span>
              <div className="ml-3 mt-1 space-y-1">
                {(newVal as any[]).map((loc, i) => {
                  const isNew = i >= oldLocs.length;
                  return (
                    <div key={i} className={`text-xs rounded px-2 py-1 ${isNew ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-muted/50"}`}>
                      {isNew && <span className="font-medium mr-1">Nieuw:</span>}
                      {loc.naam} — {loc.plaats || "?"}, {loc.adres || ""}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        if (key === "contacten" && Array.isArray(newVal)) {
          const oldContacts = (member?.contacten || []) as any[];
          return (
            <div key={key}>
              <span className="font-medium text-muted-foreground">{label}:</span>
              <div className="ml-3 mt-1 space-y-1">
                {(newVal as any[]).map((c, i) => {
                  const isNew = i >= oldContacts.length;
                  return (
                    <div key={i} className={`text-xs rounded px-2 py-1 ${isNew ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-muted/50"}`}>
                      {isNew && <span className="font-medium mr-1">Nieuw:</span>}
                      {c.naam} ({c.functie}) — {c.email}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        const oldStr = oldVal != null ? String(oldVal) : "—";
        const newStr = newVal != null ? String(newVal) : "—";

        return (
          <div key={key} className="flex items-baseline gap-2">
            <span className="font-medium text-muted-foreground">{label}:</span>
            {member ? (
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
  const { allMembersAndLeads } = useMembersData();
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
  const { data: signups, isLoading: signupsLoading } = useMembershipRequests(showAll ? "all" : "pending");
  const updateSignup = useUpdateMembershipRequest();

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Alleen het bestuur heeft toegang tot deze pagina.
      </div>
    );
  }

  const pendingCount = requests?.filter((r) => r.status === "pending").length ?? 0;
  const pendingSignups = signups?.filter((s) => s.status === "new").length ?? 0;
  const totalPending = pendingCount + pendingSignups;

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-hidden max-w-full">
      <BcdHeroBanner
        title="Goedkeuringen"
        subtitle={totalPending > 0
          ? `${totalPending} item${totalPending === 1 ? "" : "s"} wacht${totalPending === 1 ? "" : "en"} op goedkeuring`
          : "Geen openstaande zaken"}
      >
        <Button variant="secondary" size="sm" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Alleen openstaand" : "Toon alles"}
        </Button>
      </BcdHeroBanner>

      {/* Nieuwe aanmeldingen via publieke site */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <UserPlus size={14} /> Nieuwe aanmeldingen
          {pendingSignups > 0 && <Badge variant="secondary">{pendingSignups}</Badge>}
        </h2>
        {signupsLoading ? (
          <div className="text-sm text-muted-foreground py-4">Laden...</div>
        ) : signups && signups.length > 0 ? (
          <div className="space-y-3">
            {signups.map((s) => (
              <Card key={s.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-display">{s.coffeeshop_name}</span>
                      <Badge variant={s.status === "new" ? "secondary" : s.status === "approved" ? "default" : "destructive"}>
                        {s.status === "new" ? "Nieuw" : s.status === "approved" ? "Verwerkt" : "Afgewezen"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(s.created_at).toLocaleString("nl-NL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <div className="text-sm grid sm:grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex items-center gap-1.5"><User size={12} className="text-muted-foreground" />{s.full_name}</div>
                  <div className="flex items-center gap-1.5"><MapPin size={12} className="text-muted-foreground" />{s.city}</div>
                  <div className="flex items-center gap-1.5"><Mail size={12} className="text-muted-foreground" /><a href={`mailto:${s.email}`} className="hover:underline">{s.email}</a></div>
                  {s.phone && <div className="flex items-center gap-1.5"><Phone size={12} className="text-muted-foreground" /><a href={`tel:${s.phone}`} className="hover:underline">{s.phone}</a></div>}
                </div>
                {s.message && (
                  <p className="text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap">{s.message}</p>
                )}
                {s.status === "new" && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button size="sm" className="gap-1.5" disabled={updateSignup.isPending}
                      onClick={() => updateSignup.mutate({ id: s.id, status: "approved" }, {
                        onSuccess: () => toast.success("Aanmelding gemarkeerd als verwerkt"),
                        onError: (e) => toast.error("Fout: " + (e as Error).message),
                      })}>
                      <Check size={14} /> Verwerkt
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-destructive" disabled={updateSignup.isPending}
                      onClick={() => updateSignup.mutate({ id: s.id, status: "rejected" }, {
                        onSuccess: () => toast.success("Aanmelding afgewezen"),
                        onError: (e) => toast.error("Fout: " + (e as Error).message),
                      })}>
                      <X size={14} /> Afwijzen
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            {showAll ? "Nog geen aanmeldingen" : "Geen nieuwe aanmeldingen"}
          </div>
        )}
      </section>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground pt-2">
        Wijzigingsverzoeken leden
      </h2>
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
