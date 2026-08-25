import { useMemo, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMembersData } from "@/contexts/MembersDataContext";
import {
  useAgendaMutations,
  formatEventDate,
  type AgendaEvent,
  type AgendaRegistration,
} from "@/hooks/useAgenda";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: AgendaEvent;
  registrations: AgendaRegistration[];
}

export default function AgendaDeelnemersDialog({ open, onOpenChange, event, registrations }: Props) {
  const { rawMembers } = useMembersData();
  const { register, unregister } = useAgendaMutations();
  const [memberId, setMemberId] = useState("");
  const [guests, setGuests] = useState("1");

  const memberName = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of rawMembers) map.set(m.id, m.naam || m.bedrijfsnaam || `Lid #${m.id}`);
    return map;
  }, [rawMembers]);

  const totalGuests = registrations.reduce((s, r) => s + r.guests, 0);
  const alreadyRegistered = new Set(registrations.map((r) => r.member_id));
  const availableMembers = rawMembers.filter((m) => !alreadyRegistered.has(m.id));

  const addMember = () => {
    const id = Number(memberId);
    const n = Number(guests);
    if (!id || !Number.isFinite(n) || n < 1) {
      toast.error("Kies een lid en een geldig aantal personen");
      return;
    }
    register.mutate(
      { event_id: event.id, member_id: id, guests: n },
      {
        onSuccess: () => {
          toast.success("Lid aangemeld");
          setMemberId("");
          setGuests("1");
        },
        onError: (e: any) => toast.error(e?.message || "Aanmelden mislukt"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Deelnemers</DialogTitle>
          <DialogDescription>
            {event.title} — {formatEventDate(event.event_date)}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {registrations.length} aanmelding{registrations.length === 1 ? "" : "en"} · {totalGuests} persone
          {totalGuests === 1 ? "" : "n"}
          {event.max_seats != null && ` van ${event.max_seats} plaatsen`}
        </p>

        <ScrollArea className="max-h-[320px] rounded-md border border-border">
          {registrations.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Nog geen aanmeldingen</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium">{memberName.get(r.member_id) || `Lid #${r.member_id}`}</span>
                      {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {r.guests} pers.
                    </td>
                    <td className="w-10 px-2 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          unregister.mutate(r.id, {
                            onSuccess: () => toast.success("Aanmelding verwijderd"),
                            onError: (e: any) => toast.error(e?.message || "Verwijderen mislukt"),
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ScrollArea>

        <div className="space-y-2 rounded-md border border-border p-3">
          <Label>Lid aanmelden</Label>
          <div className="flex gap-2">
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Kies een lid…" />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.naam || m.bedrijfsnaam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              className="w-20"
            />
            <Button onClick={addMember} disabled={register.isPending}>
              <UserPlus className="mr-1 h-4 w-4" />
              Aanmelden
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
