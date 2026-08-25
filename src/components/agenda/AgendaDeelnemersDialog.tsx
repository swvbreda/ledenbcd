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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  const { rawMembers, rawLeads } = useMembersData();
  const { register, unregister } = useAgendaMutations();
  const [memberId, setMemberId] = useState("");
  const [guests, setGuests] = useState("1");

  const [pickerOpen, setPickerOpen] = useState(false);

  const candidates = useMemo(
    () =>
      [
        ...rawMembers.map((m) => ({ ...m, isLead: false })),
        ...rawLeads.map((m) => ({ ...m, isLead: true })),
      ].sort((a, b) =>
        (a.naam || a.bedrijfsnaam || "").localeCompare(b.naam || b.bedrijfsnaam || "", "nl"),
      ),
    [rawMembers, rawLeads],
  );

  const memberName = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of candidates) map.set(m.id, m.naam || m.bedrijfsnaam || `Lid #${m.id}`);
    return map;
  }, [candidates]);

  const totalGuests = registrations.reduce((s, r) => s + r.guests, 0);
  const alreadyRegistered = new Set(registrations.map((r) => r.member_id));
  const availableMembers = candidates.filter((m) => !alreadyRegistered.has(m.id));

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
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                  <span className="truncate">
                    {memberId ? memberName.get(Number(memberId)) : "Zoek een lid of lead…"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Typ een naam, plaats of nummer…" />
                  <CommandList>
                    <CommandEmpty>Geen resultaten</CommandEmpty>
                    <CommandGroup>
                      {availableMembers.map((m) => (
                        <CommandItem
                          key={m.id}
                          value={`${m.naam || m.bedrijfsnaam} ${m.plaats ?? ""} ${m.id}`}
                          onSelect={() => {
                            setMemberId(String(m.id));
                            setPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              memberId === String(m.id) ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="truncate">{m.naam || m.bedrijfsnaam}</span>
                          {m.plaats && (
                            <span className="ml-2 truncate text-xs text-muted-foreground">{m.plaats}</span>
                          )}
                          {m.isLead && (
                            <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                              Lead
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
