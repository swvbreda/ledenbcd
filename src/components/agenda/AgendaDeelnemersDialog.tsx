import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Pencil, Trash2, UserPlus, X } from "lucide-react";
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
  useBoardMemberOptions,
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

type Selection = { kind: "member"; id: number } | { kind: "board"; id: string } | null;

export default function AgendaDeelnemersDialog({ open, onOpenChange, event, registrations }: Props) {
  const { rawMembers, rawLeads } = useMembersData();
  const { data: boardMembers = [] } = useBoardMemberOptions();
  const { register, unregister } = useAgendaMutations();
  const [selection, setSelection] = useState<Selection>(null);
  const [guests, setGuests] = useState("1");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editGuests, setEditGuests] = useState("1");
  const [editNote, setEditNote] = useState("");

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

  const boardName = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of boardMembers) map.set(b.id, b.functie ? `${b.naam} (${b.functie})` : b.naam);
    return map;
  }, [boardMembers]);

  const totalGuests = registrations.reduce((s, r) => s + r.guests, 0);
  const takenMembers = new Set(registrations.map((r) => r.member_id).filter(Boolean) as number[]);
  const takenBoard = new Set(
    registrations.map((r) => r.board_member_id).filter(Boolean) as string[],
  );
  const availableMembers = candidates.filter((m) => !takenMembers.has(m.id));
  const availableBoard = boardMembers.filter((b) => !takenBoard.has(b.id));

  const selectionLabel =
    selection == null
      ? "Zoek een bestuurslid, lid of lead…"
      : selection.kind === "board"
        ? boardName.get(selection.id) ?? "Bestuurslid"
        : memberName.get(selection.id) ?? `Lid #${selection.id}`;

  const rowLabel = (r: AgendaRegistration) =>
    r.board_member_id
      ? boardName.get(r.board_member_id) ?? "Bestuurslid"
      : memberName.get(r.member_id as number) ?? `Lid #${r.member_id}`;

  const addAttendee = () => {
    const n = Number(guests);
    if (!selection || !Number.isFinite(n) || n < 1) {
      toast.error("Kies een deelnemer en een geldig aantal personen");
      return;
    }
    register.mutate(
      {
        event_id: event.id,
        member_id: selection.kind === "member" ? selection.id : null,
        board_member_id: selection.kind === "board" ? selection.id : null,
        guests: n,
      },
      {
        onSuccess: (res) => {
          toast.success(
            res?.emailed
              ? "Aangemeld — bevestiging verstuurd"
              : "Aangemeld (geen bevestigingsmail verstuurd)",
          );
          setSelection(null);
          setGuests("1");
        },
        onError: (e: any) => toast.error(e?.message || "Aanmelden mislukt"),
      },
    );
  };

  const startEdit = (r: AgendaRegistration) => {
    setEditId(r.id);
    setEditGuests(String(r.guests));
    setEditNote(r.note ?? "");
  };

  const saveEdit = () => {
    const n = Number(editGuests);
    if (!editId || !Number.isFinite(n) || n < 1) {
      toast.error("Vul een geldig aantal personen in");
      return;
    }
    register.mutate(
      { id: editId, event_id: event.id, guests: n, note: editNote.trim() || null },
      {
        onSuccess: () => {
          toast.success("Aanmelding bijgewerkt");
          setEditId(null);
        },
        onError: (e: any) => toast.error(e?.message || "Wijzigen mislukt"),
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
                  <tr key={r.id} className="border-b border-border/40 last:border-0 align-top">
                    <td className="px-3 py-2">
                      <span className="font-medium">{rowLabel(r)}</span>
                      {r.board_member_id && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                          Bestuur
                        </span>
                      )}
                      {editId === r.id ? (
                        <Input
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Opmerking"
                          className="mt-2 h-8"
                        />
                      ) : (
                        r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {editId === r.id ? (
                        <Input
                          type="number"
                          min={1}
                          value={editGuests}
                          onChange={(e) => setEditGuests(e.target.value)}
                          className="h-8 w-16"
                        />
                      ) : (
                        `${r.guests} pers.`
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      {editId === r.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" className="h-7" onClick={saveEdit} disabled={register.isPending}>
                            Opslaan
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEdit(r)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
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
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ScrollArea>

        <div className="space-y-2 rounded-md border border-border p-3">
          <Label>Deelnemer aanmelden</Label>
          <div className="flex gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                  <span className="truncate">{selectionLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Typ een naam, plaats of nummer…" />
                  <CommandList>
                    <CommandEmpty>Geen resultaten</CommandEmpty>
                    <CommandGroup heading="Bestuur">
                      {availableBoard.map((b) => (
                        <CommandItem
                          key={b.id}
                          value={`${b.naam} ${b.functie ?? ""} bestuur`}
                          onSelect={() => {
                            setSelection({ kind: "board", id: b.id });
                            setPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selection?.kind === "board" && selection.id === b.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <span className="truncate">{b.naam}</span>
                          {b.functie && (
                            <span className="ml-2 truncate text-xs text-muted-foreground">
                              {b.functie}
                            </span>
                          )}
                          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                            Bestuur
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandGroup heading="Leden & leads">
                      {availableMembers.map((m) => (
                        <CommandItem
                          key={m.id}
                          value={`${m.naam || m.bedrijfsnaam} ${m.plaats ?? ""} ${m.id}`}
                          onSelect={() => {
                            setSelection({ kind: "member", id: m.id });
                            setPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selection?.kind === "member" && selection.id === m.id
                                ? "opacity-100"
                                : "opacity-0",
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
            <Button onClick={addAttendee} disabled={register.isPending}>
              <UserPlus className="mr-1 h-4 w-4" />
              Aanmelden
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
