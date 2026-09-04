import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Inbox,
  Link2,
  Mail,
  MapPin,
  Phone,
  Store,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { normalizePhone, formatPhone } from "@/lib/phoneMatch";
import { matchParticipants, memberLabel } from "@/lib/communityMatch";
import SaveContactToMemberDialog, {
  type PendingContactLink,
} from "@/components/community/SaveContactToMemberDialog";


type SelfLink = {
  id: string;
  whatsapp_name: string | null;
  full_name: string;
  phone: string;
  coffeeshop_name: string | null;
  city: string | null;
  email: string | null;
  note: string | null;
  status: string;
  member_id: number | null;
  created_at: string;
};

const CommunitySelfLinkList = () => {
  const { rawMembers, rawLeads } = useMembersData();
  const allMembers = useMemo(() => [...rawMembers, ...rawLeads], [rawMembers, rawLeads]);

  const [rows, setRows] = useState<SelfLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [pending, setPending] = useState<{ row: SelfLink; link: PendingContactLink } | null>(null);

  /** Vraagt eerst wat er bij het lid moet worden opgeslagen, koppelt daarna. */
  const requestLink = (row: SelfLink, memberId: number) => {
    setOpenFor(null);
    setPending({
      row,
      link: {
        memberId,
        naam: row.full_name,
        telefoon: row.phone,
        email: row.email,
      },
    });
  };


  const load = async () => {
    const { data } = await supabase
      .from("community_self_links")
      .select(
        "id, whatsapp_name, full_name, phone, coffeeshop_name, city, email, note, status, member_id, created_at",
      )
      .order("created_at", { ascending: false });
    setRows((data || []) as SelfLink[]);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const open = rows.filter((r) => r.status === "nieuw");
  const handled = rows.filter((r) => r.status !== "nieuw");

  /** Voorstel per aanmelding op basis van telefoon en naam/shopnaam. */
  const suggestionFor = (row: SelfLink) => {
    const label = [row.full_name, row.coffeeshop_name].filter(Boolean).join(" ");
    const { certain, suggested } = matchParticipants(
      [{ id: row.id, display_name: label, phone: row.phone, member_id: null }],
      allMembers,
    );
    if (certain[0]) return { memberId: certain[0].memberId, label: certain[0].memberLabel, detail: "telefoonnummer" };
    const top = suggested[0]?.candidates[0];
    return top ? { memberId: top.memberId, label: top.memberLabel, detail: top.detail } : null;
  };

  /** Koppel de aanmelding aan een lid en werk de WhatsApp-deelnemer bij. */
  const link = async (row: SelfLink, memberId: number) => {
    setBusyId(row.id);
    setOpenFor(null);
    try {
      const phone = normalizePhone(row.phone);
      let participantId: string | null = null;

      if (phone) {
        const { data: existing } = await supabase
          .from("whatsapp_participants")
          .select("id, phone")
          .not("phone", "is", null);
        const hit = (existing || []).find((p) => normalizePhone(p.phone) === phone);
        if (hit) {
          participantId = hit.id;
          await supabase
            .from("whatsapp_participants")
            .update({ member_id: memberId })
            .eq("id", hit.id);
        }
      }

      if (!participantId) {
        const displayName = row.whatsapp_name || row.full_name;
        const { data: inserted } = await supabase
          .from("whatsapp_participants")
          .insert({
            display_name: displayName,
            phone: row.phone,
            member_id: memberId,
            sort_key: displayName.toLowerCase(),
          })
          .select("id")
          .maybeSingle();
        participantId = inserted?.id ?? null;
      }

      const { error } = await supabase
        .from("community_self_links")
        .update({
          member_id: memberId,
          participant_id: participantId,
          status: "gekoppeld",
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;

      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, member_id: memberId, status: "gekoppeld" } : r,
        ),
      );
      toast({ title: "Gekoppeld", description: `${row.full_name} → lid #${memberId}` });
    } catch (e) {
      toast({
        title: "Koppelen mislukt",
        description: e instanceof Error ? e.message : "Onbekende fout",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (row: SelfLink) => {
    setBusyId(row.id);
    const { error } = await supabase
      .from("community_self_links")
      .update({ status: "afgewezen", processed_at: new Date().toISOString() })
      .eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Mislukt", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: "afgewezen" } : r)));
  };

  const remove = async (row: SelfLink) => {
    if (!confirm("Deze aanmelding verwijderen?")) return;
    setBusyId(row.id);
    const { error } = await supabase.from("community_self_links").delete().eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Verwijderen mislukt", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/koppelen` : "/koppelen";

  if (isLoading) {
    return (
      <div className="border border-border rounded-md p-8 text-center text-sm text-muted-foreground">
        Laden…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 p-4 rounded-md border border-border bg-muted/40">
        <Link2 size={16} className="text-brand-red" />
        <span className="text-sm">
          Deel deze link in de community:{" "}
          <span className="font-mono text-xs">{shareUrl}</span>
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard?.writeText(shareUrl);
            toast({ title: "Link gekopieerd" });
          }}
        >
          Kopieer link
        </Button>
      </div>

      {open.length === 0 ? (
        <div className="border border-border rounded-md p-8 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto mb-2 opacity-50" size={20} />
          Geen nieuwe aanmeldingen.
        </div>
      ) : (
        <ul className="border border-border rounded-md divide-y divide-border">
          {open.map((row) => {
            const s = suggestionFor(row);
            return (
              <li key={row.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 font-medium">
                    <User size={13} className="text-muted-foreground/60" />
                    <span className="truncate">{row.full_name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone size={12} />
                      <span className="font-mono">{formatPhone(row.phone) || row.phone}</span>
                    </span>
                    {row.coffeeshop_name && (
                      <span className="flex items-center gap-1">
                        <Store size={12} /> {row.coffeeshop_name}
                      </span>
                    )}
                    {row.city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {row.city}
                      </span>
                    )}
                    {row.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={12} /> {row.email}
                      </span>
                    )}
                  </div>
                  {row.note && <p className="text-xs text-muted-foreground italic">“{row.note}”</p>}
                  {s && (
                    <p className="text-xs text-brand-red">
                      Voorstel: {s.label} — {s.detail}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-brand-red hover:bg-brand-red/90 text-white"
                      disabled={busyId === row.id}
                      onClick={() => link(row, s.memberId)}
                    >
                      <Check size={14} /> Koppel
                    </Button>
                  )}
                  <Popover
                    open={openFor === row.id}
                    onOpenChange={(o) => setOpenFor(o ? row.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={busyId === row.id}
                      >
                        Kies lid <ChevronsUpDown size={12} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="end">
                      <Command>
                        <CommandInput placeholder="Zoek coffeeshop…" />
                        <CommandList>
                          <CommandEmpty>Geen resultaten.</CommandEmpty>
                          <CommandGroup>
                            {allMembers.map((m) => (
                              <CommandItem
                                key={m.id}
                                value={`${memberLabel(m)} ${m.plaats || ""} ${m.bedrijfsnaam || ""}`}
                                onSelect={() => link(row, m.id)}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="truncate">{memberLabel(m)}</div>
                                  {m.plaats && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {m.plaats}
                                    </div>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    title="Afwijzen"
                    disabled={busyId === row.id}
                    onClick={() => reject(row)}
                  >
                    <X size={14} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {handled.length > 0 && (
        <div className="border border-border rounded-md">
          <p className="p-3 border-b border-border bg-muted/40 text-sm font-semibold">
            Afgehandeld ({handled.length})
          </p>
          <ul className="divide-y divide-border">
            {handled.map((row) => (
              <li key={row.id} className="p-3 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{row.full_name}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {row.coffeeshop_name} · {formatPhone(row.phone) || row.phone}
                  </span>
                </div>
                <span
                  className={
                    row.status === "gekoppeld"
                      ? "text-xs font-semibold text-emerald-600"
                      : "text-xs font-semibold text-muted-foreground"
                  }
                >
                  {row.status === "gekoppeld" ? `Gekoppeld aan #${row.member_id}` : "Afgewezen"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={busyId === row.id}
                  onClick={() => remove(row)}
                  title="Verwijderen"
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CommunitySelfLinkList;
