import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Minus, Pencil, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

/** Zorgt dat de namenlijst exact `count` velden heeft. */
function resizeNames(names: string[], count: number) {
  const next = names.slice(0, count);
  while (next.length < count) next.push("");
  return next;
}

function Stepper({
  value,
  onChange,
  min = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <div className="flex h-10 items-center overflow-hidden rounded-md border border-input bg-background">
      <button
        type="button"
        aria-label="Minder personen"
        className="h-full w-10 border-r border-input text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Minus className="mx-auto h-4 w-4" />
      </button>
      <span className="w-12 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="Meer personen"
        className="h-full w-10 border-l border-input text-muted-foreground transition-colors hover:bg-muted"
        onClick={() => onChange(value + 1)}
      >
        <Plus className="mx-auto h-4 w-4" />
      </button>
    </div>
  );
}

export default function AgendaDeelnemersDialog({ open, onOpenChange, event, registrations }: Props) {
  const { rawMembers, rawLeads } = useMembersData();
  const { data: boardMembers = [] } = useBoardMemberOptions();
  const { register, unregister } = useAgendaMutations();
  const [selection, setSelection] = useState<Selection>(null);
  const [guests, setGuests] = useState(1);
  const [names, setNames] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editGuests, setEditGuests] = useState(1);
  const [editNames, setEditNames] = useState<string[]>([""]);
  const [editNote, setEditNote] = useState("");

  useEffect(() => {
    setNames((prev) => resizeNames(prev, guests));
  }, [guests]);

  useEffect(() => {
    setEditNames((prev) => resizeNames(prev, editGuests));
  }, [editGuests]);

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

  const resetForm = () => {
    setSelection(null);
    setGuests(1);
    setNames([""]);
    setNote("");
  };

  const addAttendee = () => {
    if (!selection) {
      toast.error("Kies eerst een deelnemer");
      return;
    }
    register.mutate(
      {
        event_id: event.id,
        member_id: selection.kind === "member" ? selection.id : null,
        board_member_id: selection.kind === "board" ? selection.id : null,
        guests,
        note: note.trim() || null,
        attendee_names: names,
      },
      {
        onSuccess: (res) => {
          toast.success(
            res?.emailed
              ? "Aangemeld — bevestiging verstuurd"
              : "Aangemeld (geen bevestigingsmail verstuurd)",
          );
          resetForm();
        },
        onError: (e: any) => toast.error(e?.message || "Aanmelden mislukt"),
      },
    );
  };

  const startEdit = (r: AgendaRegistration) => {
    setEditId(r.id);
    setEditGuests(r.guests);
    setEditNames(resizeNames(r.attendee_names ?? [], r.guests));
    setEditNote(r.note ?? "");
  };

  const saveEdit = () => {
    if (!editId) return;
    register.mutate(
      {
        id: editId,
        event_id: event.id,
        guests: editGuests,
        note: editNote.trim() || null,
        attendee_names: editNames,
      },
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
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="space-y-1 border-b border-border p-6 text-left">
          <DialogTitle className="font-display text-2xl uppercase leading-none">
            Deelnemers
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-primary">
            {event.title} — {formatEventDate(event.event_date)}
          </DialogDescription>
          <div className="flex flex-wrap gap-2 pt-3">
            <span className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="font-semibold tabular-nums">{registrations.length}</span>
              <span className="text-muted-foreground">
                aanmelding{registrations.length === 1 ? "" : "en"}
              </span>
            </span>
            <span className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm">
              <span className="font-semibold tabular-nums">{totalGuests}</span>
              <span className="text-muted-foreground">
                persone{totalGuests === 1 ? "" : "n"}
                {event.max_seats != null && ` van ${event.max_seats}`}
              </span>
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-8 p-6">
            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Huidige deelnemers
              </h3>
              {registrations.length === 0 ? (
                <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                  Nog geen aanmeldingen
                </p>
              ) : (
                <div className="space-y-3">
                  {registrations.map((r) => {
                    const rowNames = (r.attendee_names ?? []).filter((n) => n.trim().length > 0);
                    return (
                      <div
                        key={r.id}
                        className="rounded-xl border border-border p-4 transition-colors hover:border-primary/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{rowLabel(r)}</span>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                                {r.board_member_id ? "Bestuur" : "Lid"}
                              </span>
                              <span className="text-sm text-muted-foreground tabular-nums">
                                {r.guests} pers.
                              </span>
                            </div>
                            {editId !== r.id && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {rowNames.length > 0 ? (
                                  <span className="text-foreground">{rowNames.join(", ")}</span>
                                ) : (
                                  <span className="italic">Geen namen ingevuld</span>
                                )}
                              </p>
                            )}
                            {editId !== r.id && r.note && (
                              <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {editId === r.id ? (
                              <>
                                <Button
                                  size="sm"
                                  className="h-8"
                                  onClick={saveEdit}
                                  disabled={register.isPending}
                                >
                                  Opslaan
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setEditId(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => startEdit(r)}
                                >
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    unregister.mutate(r.id, {
                                      onSuccess: () => toast.success("Aanmelding verwijderd"),
                                      onError: (e: any) =>
                                        toast.error(e?.message || "Verwijderen mislukt"),
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {editId === r.id && (
                          <div className="mt-4 space-y-3 border-t border-border pt-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs uppercase text-muted-foreground">
                                Aantal personen
                              </Label>
                              <Stepper value={editGuests} onChange={setEditGuests} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs uppercase text-muted-foreground">
                                Namen
                              </Label>
                              {editNames.map((n, i) => (
                                <Input
                                  key={i}
                                  value={n}
                                  placeholder={`Naam persoon ${i + 1}`}
                                  onChange={(e) =>
                                    setEditNames((prev) =>
                                      prev.map((v, j) => (j === i ? e.target.value : v)),
                                    )
                                  }
                                />
                              ))}
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs uppercase text-muted-foreground">
                                Opmerking
                              </Label>
                              <Textarea
                                rows={2}
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                className="resize-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-muted/30 p-5">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Nieuwe aanmelding
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Wie meld je aan?
                  </Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between bg-background font-normal"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{selectionLabel}</span>
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                    >
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
                                  setNames((prev) =>
                                    prev.map((v, i) => (i === 0 && !v.trim() ? b.naam : v)),
                                  );
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
                                  <span className="ml-2 truncate text-xs text-muted-foreground">
                                    {m.plaats}
                                  </span>
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
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">
                      Aantal personen
                    </Label>
                    <Stepper value={guests} onChange={setGuests} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs uppercase text-muted-foreground">
                      Namen van de personen
                    </Label>
                    <div className="space-y-2">
                      {names.map((n, i) => (
                        <Input
                          key={i}
                          value={n}
                          placeholder={`Naam persoon ${i + 1}`}
                          className="bg-background"
                          onChange={(e) =>
                            setNames((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Eventuele opmerking
                  </Label>
                  <Textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Bijv. dieetwensen of vragen…"
                    className="resize-none bg-background"
                  />
                </div>

                <Button
                  className="w-full uppercase tracking-wide"
                  onClick={addAttendee}
                  disabled={register.isPending}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Aanmelding opslaan
                </Button>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
