import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check, ChevronsUpDown, Phone, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useMembersData } from "@/contexts/MembersDataContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Participant = {
  id: string;
  display_name: string;
  phone: string | null;
  member_id: number | null;
  sort_key: string | null;
};

const CommunityTodoList = () => {
  const { rawMembers, rawLeads } = useMembersData();
  const allMembers = useMemo(
    () => [...rawMembers, ...rawLeads],
    [rawMembers, rawLeads],
  );

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("whatsapp_participants")
      .select("id, display_name, phone, member_id, sort_key")
      .is("member_id", null)
      .order("sort_key");
    setParticipants((data || []) as Participant[]);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter(
      (p) =>
        p.display_name.toLowerCase().includes(q) ||
        (p.phone || "").toLowerCase().includes(q),
    );
  }, [participants, query]);

  const linkToMember = async (participantId: string, memberId: number) => {
    setBusyId(participantId);
    const { error } = await supabase
      .from("whatsapp_participants")
      .update({ member_id: memberId })
      .eq("id", participantId);
    setBusyId(null);
    setOpenFor(null);
    if (error) {
      toast({ title: "Koppelen mislukt", description: error.message, variant: "destructive" });
      return;
    }
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    toast({ title: "Gekoppeld" });
  };

  const removeParticipant = async (participantId: string) => {
    if (!confirm("Deze deelnemer verwijderen uit de community-lijst?")) return;
    setBusyId(participantId);
    const { error } = await supabase
      .from("whatsapp_participants")
      .delete()
      .eq("id", participantId);
    setBusyId(null);
    if (error) {
      toast({ title: "Verwijderen mislukt", description: error.message, variant: "destructive" });
      return;
    }
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    toast({ title: "Verwijderd" });
  };

  if (isLoading) {
    return (
      <div className="border border-border rounded-md p-8 text-center text-sm text-muted-foreground">
        Laden…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-md border-2 border-brand-red/30 bg-brand-red/5">
        <AlertCircle className="text-brand-red shrink-0 mt-0.5" size={18} />
        <div className="text-sm">
          <p className="font-semibold">
            {participants.length} deelnemers nog niet gekoppeld
          </p>
          <p className="text-muted-foreground">
            Koppel elke deelnemer aan de juiste coffeeshop, of verwijder uit de lijst
            als ze geen lid meer zijn.
          </p>
        </div>
      </div>

      <Input
        placeholder="Zoek op naam of nummer"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />

      {filtered.length === 0 ? (
        <div className="border border-border rounded-md p-8 text-center text-sm text-muted-foreground">
          {participants.length === 0
            ? "Alle deelnemers zijn gekoppeld 🎉"
            : "Geen deelnemers gevonden."}
        </div>
      ) : (
        <ul className="border border-border rounded-md divide-y divide-border">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="p-3 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-medium">
                  <User size={13} className="text-muted-foreground/60" />
                  <span className="truncate">{p.display_name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Phone size={12} />
                  <span className="font-mono">{p.phone || "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Popover
                  open={openFor === p.id}
                  onOpenChange={(o) => setOpenFor(o ? p.id : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={busyId === p.id}
                    >
                      Koppel aan lid
                      <ChevronsUpDown size={12} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Zoek coffeeshop…" />
                      <CommandList>
                        <CommandEmpty>Geen resultaten.</CommandEmpty>
                        <CommandGroup>
                          {allMembers.map((m) => {
                            const label = m.naam || m.bedrijfsnaam || `Lid #${m.id}`;
                            return (
                              <CommandItem
                                key={m.id}
                                value={`${label} ${m.plaats || ""} ${m.bedrijfsnaam || ""}`}
                                onSelect={() => linkToMember(p.id, m.id)}
                              >
                                <Check className={cn("mr-2 h-3 w-3 opacity-0")} />
                                <div className="flex-1 min-w-0">
                                  <div className="truncate">{label}</div>
                                  {m.plaats && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {m.plaats}
                                    </div>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeParticipant(p.id)}
                  disabled={busyId === p.id}
                  title="Verwijder uit lijst"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CommunityTodoList;