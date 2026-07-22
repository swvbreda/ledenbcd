import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Mail, Phone, FileText, Users, Calendar, Hash, Globe, Instagram, ExternalLink, Shield, Lock, UserCheck, Archive, ArchiveRestore, Link2, Pencil, MessageSquare, Send, Trash2, Store, Clock, CheckCircle2, AlertCircle, Euro } from "lucide-react";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useLeadConversions } from "@/hooks/useLeadConversions";
import ConvertLeadDialog from "@/components/ConvertLeadDialog";
import { getMembershipYears } from "@/lib/membership";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { archiveMember, restoreMember } from "@/hooks/useArchive";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMergedMember, useSaveMemberEdit } from "@/hooks/useMemberEdits";
import MemberEditForm from "@/components/MemberEditForm";
import MailingPreferences from "@/components/MailingPreferences";
import { useMemberContributions, useMemberInvoices } from "@/hooks/useContributions";

const STORAGE_KEY = (memberId: number) => `bcd-contactpersoon-${memberId}`;

const getStoredContactpersonen = (memberId: number): string[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(memberId));
    if (!raw) return null;
    if (raw.startsWith("[")) return JSON.parse(raw) as string[];
    return [raw];
  } catch { return null; }
};

const setStoredContactpersonen = (memberId: number, namen: string[]) => {
  try {
    if (namen.length > 0) localStorage.setItem(STORAGE_KEY(memberId), JSON.stringify(namen));
    else localStorage.removeItem(STORAGE_KEY(memberId));
  } catch {}
};

const MemberDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isInhuur, linkedMemberIds } = useAuth();
  const { rawMembers: allMembers, allMembersAndLeads, rawLeads, rawOldMembers, refetch: refetchMembers } = useMembersData();
  const isOwnProfile = linkedMemberIds.includes(Number(id));
  const canSeeContacts = isAdmin || isInhuur || isOwnProfile;
  const canSeeFinance = isAdmin || isOwnProfile;
  const memberId = Number(id);
  const { member, isLoading, hasPendingEdit } = useMergedMember(memberId);
  const saveContactpersoonMutation = useSaveMemberEdit();
  const { conversions, refresh: refreshConversions, loading: conversionsLoading } = useLeadConversions();
  const isLead = useMemo(() => rawLeads.some((l) => l.id === memberId), [memberId]);

  // Redirect converted leads to their new lidnummer
  const convertedTo = useMemo(() => conversions.find((c) => c.lead_id === memberId), [conversions, memberId]);
  useEffect(() => {
    if (convertedTo) {
      navigate(`/leden/${convertedTo.lidnummer}`, { replace: true });
    }
  }, [convertedTo, navigate]);
  const { data: memberContributions } = useMemberContributions(memberId);
  const { data: memberInvoices } = useMemberInvoices(memberId);
  const currentYearContrib = useMemo(() => {
    const cy = new Date().getFullYear();
    return (memberContributions ?? []).find((c) => c.year === cy);
  }, [memberContributions]);

  const initialCps: string[] = member
    ? (member.contactpersonen && member.contactpersonen.length > 0
        ? member.contactpersonen
        : getStoredContactpersonen(member.id) ?? (member.contactpersoon ? [member.contactpersoon] : []))
    : [];
  const [contactpersonen, setContactpersonen] = useState<string[]>(initialCps);
  const [archived, setArchived] = useState(() => rawOldMembers.some((m) => m.id === memberId));
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState<{ id: string; note: string; created_at: string }[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Build a lookup: contact name (lowercased) -> list of other members that share this contact
  const sharedContactMap = useMemo(() => {
    const map = new Map<string, { id: number; naam: string }[]>();
    allMembersAndLeads.forEach((m) => {
      m.contacten?.forEach((c) => {
        if (!c.naam) return;
        const key = c.naam.trim().toLowerCase();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ id: m.id, naam: m.naam });
      });
    });
    return map;
  }, []);

  useEffect(() => {
    if (!memberId || !isAdmin) return;
    supabase
      .from("member_notes")
      .select("id, note, created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setNotes(data);
      });
  }, [memberId, isAdmin]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) { setSavingNote(false); return; }
    const { data, error } = await supabase
      .from("member_notes")
      .insert({ member_id: memberId, note: newNote.trim(), created_by: userId })
      .select("id, note, created_at")
      .single();
    setSavingNote(false);
    if (error) { toast.error("Opmerking opslaan mislukt"); return; }
    if (data) setNotes((prev) => [data, ...prev]);
    setNewNote("");
    toast.success("Opmerking toegevoegd");
  };

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await supabase.from("member_notes").delete().eq("id", noteId);
    if (error) { toast.error("Verwijderen mislukt"); return; }
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Laden...</div>;
  }

  if (!member) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Lid niet gevonden</p>
        <button onClick={() => navigate("/leden")} className="mt-4 text-primary hover:underline text-sm">
          Terug naar ledenlijst
        </button>
      </div>
    );
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 w-full">
      {/* Terug-knop */}
      <button
        onClick={() => navigate(-1)}
        className="p-1.5 sm:p-2 rounded-md hover:bg-muted transition-colors"
      >
        <ArrowLeft size={18} />
      </button>

      {/* Pending edit banner */}
      {hasPendingEdit && !editing && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <Clock size={16} className="shrink-0" />
          <span>Je hebt wijzigingen ingediend die wachten op goedkeuring door het bestuur. De getoonde gegevens bevatten je voorgestelde wijzigingen.</span>
        </div>
      )}

      {/* Edit mode */}
      {editing ? (
        <MemberEditForm member={member} editing={editing} setEditing={setEditing} />
      ) : (
        <>
          {/* Coffeeshop gegevens — alles in één blok */}
          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            {/* Naam & badges + acties */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold font-mono">Lidnr. {member.id}</span>
                  <h2 className="text-lg sm:text-2xl font-bold font-display">{member.naam}</h2>
                  {member.oprichter && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-md text-[11px] sm:text-xs font-semibold">
                      ★ Oprichter
                    </span>
                  )}
                  {member.bestuursfunctie && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/15 text-accent-foreground rounded-md text-[11px] sm:text-xs font-semibold">
                      <Shield size={12} />
                      {member.bestuursfunctie}
                    </span>
                  )}
                  {canSeeFinance && currentYearContrib && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-semibold ${
                      currentYearContrib.paid
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "bg-destructive/15 text-destructive"
                    }`}>
                      {currentYearContrib.paid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {currentYearContrib.paid ? "Contributie betaald" : "Contributie openstaand"}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} /> {member.plaats}
                  </span>
                  {(() => {
                    const stadsdelen = [
                      ...new Set(
                        member.locaties
                          ?.map((l) => l.stadsdeel)
                          .filter(Boolean) || []
                      ),
                    ];
                    if (stadsdelen.length === 0 && member.stadsdeel) {
                      stadsdelen.push(member.stadsdeel);
                    }
                    return stadsdelen.map((sd) => (
                      <span key={sd} className="px-2 py-0.5 bg-muted rounded text-xs">{sd}</span>
                    ));
                  })()}
                  {(() => {
                    const jarenLid = getMembershipYears(member);
                    return jarenLid !== null ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        jarenLid >= 30
                          ? "bg-success/10 text-success"
                          : jarenLid >= 10
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {jarenLid} jaar lid
                      </span>
                    ) : null;
                  })()}
                  {archived && (
                    <span className="px-2 py-0.5 bg-destructive/10 text-destructive rounded text-xs font-medium">
                      Gearchiveerd
                    </span>
                  )}
                </div>
              </div>
              {(isAdmin || isOwnProfile) && !editing && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)} disabled={isLoading}>
                    <Pencil size={14} /> {isLoading ? "Laden..." : "Bewerken"}
                  </Button>
                  {isAdmin && isLead && member && (
                    <ConvertLeadDialog
                      lead={member}
                      conversions={conversions}
                      onConverted={() => {
                        refreshConversions();
                        navigate("/leden?tab=leden");
                      }}
                    />
                  )}
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        {archived ? (
                          <Button variant="outline" size="sm" className="gap-1.5 text-primary">
                            <ArchiveRestore size={14} /> Herstellen
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="gap-1.5 text-destructive">
                            <Archive size={14} /> Archiveren
                          </Button>
                        )}
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {archived ? "Lid herstellen?" : "Lid archiveren?"}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {archived
                              ? `${member.naam} wordt teruggeplaatst in de actieve ledenlijst.`
                              : `${member.naam} wordt verplaatst naar oud-leden. Je kunt dit later ongedaan maken.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuleren</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              try {
                                if (archived) {
                                  await restoreMember(member.id);
                                  setArchived(false);
                                  toast.success(`${member.naam} is hersteld`);
                                } else {
                                  await archiveMember(member.id);
                                  setArchived(true);
                                  toast.success(`${member.naam} is gearchiveerd`);
                                }
                                refetchMembers();
                              } catch (err) {
                                toast.error("Fout bij archiveren/herstellen");
                                console.error(err);
                              }
                            }}
                          >
                            {archived ? "Herstellen" : "Archiveren"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-border" />

            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">Aantal locaties</span>
              <span className="font-medium">{member.aantalLocaties}</span>

              {(member.oprichtingsDatum || member.oprichtingJaar) && (
                <>
                  <span className="text-muted-foreground">Opgericht</span>
                  <span className="font-medium">
                    {member.oprichtingsDatum
                      ? formatDate(member.oprichtingsDatum)
                      : member.oprichtingJaar}
                  </span>
                </>
              )}

              {member.lidSinds && (
                <>
                  <span className="text-muted-foreground">Lid sinds</span>
                  <span className="font-medium">
                    {member.lidSinds}
                  </span>
                </>
              )}
            </div>

            {(member.website || member.instagram || member.facebook) && (
              <>
                <div className="border-t border-border" />
                <div className="flex flex-wrap gap-3">
                  {member.website && (
                    <a href={member.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline">
                      <Globe size={14} /> {member.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      <ExternalLink size={12} />
                    </a>
                  )}
                  {member.instagram && (
                    <a href={`https://instagram.com/${member.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline">
                      <Instagram size={14} /> @{member.instagram}
                      <ExternalLink size={12} />
                    </a>
                  )}
                  {member.facebook && (
                    <a href={`https://facebook.com/${member.facebook}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline">
                      Facebook <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </>
            )}
          </div>

          {canSeeContacts ? (
            <div className={`grid grid-cols-1 ${canSeeFinance ? 'lg:grid-cols-2' : ''} gap-4`}>
              {/* Contactpersonen */}
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
                  <Users size={16} className="text-brand-red" /> Contactpersonen ({member.contacten.length})
                </h3>
                <div className="space-y-4">
                  {member.contacten.length > 0 ? (
                    member.contacten.map((c, i) => {
                      const isSelected = contactpersonen.includes(c.naam);
                      return (
                        <div key={i} className={`${i > 0 ? "pt-3 border-t border-border" : ""} flex items-start gap-3`}>
                          {isAdmin && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="mt-0.5">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        const next = checked
                                          ? Array.from(new Set([...contactpersonen, c.naam]))
                                          : contactpersonen.filter((n) => n !== c.naam);
                                        setContactpersonen(next);
                                        setStoredContactpersonen(member.id, next);
                                        saveContactpersoonMutation.mutate(
                                          {
                                            member_id: member.id,
                                            data: {
                                              contactpersonen: next,
                                              contactpersoon: next[0] || member.contactpersoon,
                                            },
                                          },
                                          {
                                            onSuccess: () => toast.success("Contactpersonen opgeslagen"),
                                            onError: () => toast.error("Opslaan mislukt"),
                                          }
                                        );
                                      }}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{isSelected ? "Contactpersoon deselecteren" : "Markeer als contactpersoon"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <div className="flex-1">
                            <p className="font-medium inline-flex items-center gap-1.5">
                              {c.naam}
                              {isSelected && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-semibold uppercase tracking-wide">
                                  <UserCheck size={10} /> Contactpersoon
                                </span>
                              )}
                            </p>
                            {c.functie && <p className="text-xs text-muted-foreground">{c.functie}</p>}
                            {c.email && (
                              <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:underline mt-1">
                                <Mail size={13} /> {c.email}
                              </a>
                            )}
                            {c.telefoon && (
                              <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                                <Phone size={13} /> {c.telefoon}
                              </p>
                            )}
                            {c.verjaardag && (
                              <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                                <Calendar size={13} /> {new Date(c.verjaardag).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}
                              </p>
                            )}
                            {(() => {
                              const key = c.naam?.trim().toLowerCase();
                              if (!key) return null;
                              const others = (sharedContactMap.get(key) || []).filter((o) => o.id !== member.id);
                              if (others.length === 0) return null;
                              return (
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <Link2 size={12} className="text-muted-foreground shrink-0" />
                                  <span className="text-[11px] text-muted-foreground">Ook bij:</span>
                                  {others.map((o) => (
                                    <button
                                      key={o.id}
                                      onClick={() => navigate(`/leden/${o.id}`)}
                                      className="text-[11px] text-primary hover:underline"
                                    >
                                      {o.naam}
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">Geen contactpersonen bekend</p>
                  )}
                </div>
              </div>

              {/* Factuurgegevens - alleen voor admin en eigen profiel */}
              {canSeeFinance && (
                <div className="bg-card rounded-lg border border-border p-5">
                  <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
                    <FileText size={16} className="text-brand-red" /> Factuurgegevens
                  </h3>
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Bedrijfsnaam</span>
                    <span className="font-medium">{member.factuurBedrijfsnaam || member.bedrijfsnaam || "—"}</span>

                    <span className="text-muted-foreground">KVK</span>
                    <span className="font-mono">{member.factuurKvk || member.kvk || "—"}</span>

                    <span className="text-muted-foreground">Adres</span>
                    <span>
                      {member.factuurAdres ? (
                        <>
                          {member.factuurAdres}
                          <br />
                          {member.factuurPostcode && <>{member.factuurPostcode} </>}
                          {member.factuurPlaats}
                        </>
                      ) : "—"}
                    </span>

                    <span className="text-muted-foreground">E-mail</span>
                    <span>
                      {member.factuurEmail ? (
                        <a href={`mailto:${member.factuurEmail}`} className="text-muted-foreground hover:underline">
                          {member.factuurEmail}
                        </a>
                      ) : "—"}
                    </span>

                    <span className="text-muted-foreground">Telefoon</span>
                    <span>{member.factuurTelefoon || "—"}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border p-5 flex items-center gap-3 text-muted-foreground">
              <Lock size={16} />
              <p className="text-sm">Contactgegevens en factuurgegevens zijn alleen zichtbaar voor het eigen profiel en bestuursleden.</p>
            </div>
          )}

          {/* Contributie & Facturen */}
          {canSeeFinance && ((memberContributions ?? []).length > 0 || (memberInvoices ?? []).length > 0) && (
            <div className="bg-card rounded-lg border border-border p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold font-display flex items-center gap-2">
                  <Euro size={16} className="text-brand-red" /> Contributie & facturen
                </h3>
                <span className="text-xs text-muted-foreground">
                  {(memberInvoices ?? []).length} factuur{(memberInvoices ?? []).length === 1 ? "" : "en"}
                </span>
              </div>

              <div className="space-y-2">
                <div className="hidden md:grid grid-cols-[repeat(6,minmax(0,1fr))] items-center rounded-md px-4 pb-1 text-xs font-medium text-muted-foreground sticky top-0 bg-card z-10">
                  <span className="text-center">Jaar</span>
                  <span className="text-center">Factuurdatum</span>
                  <span className="text-center">Factuurnummer</span>
                  <span className="text-center">Bedrag</span>
                  <span className="text-center">Status</span>
                  <span className="text-center">Betaald op</span>
                </div>

                {Array.from(
                  new Set([
                    ...(memberContributions ?? []).map((c) => c.year),
                    ...(memberInvoices ?? []).map((i) => i.year),
                  ])
                )
                  .sort((a, b) => b - a)
                  .map((year) => {
                    const contrib = (memberContributions ?? []).find((c) => c.year === year);
                    const yearInvoices = (memberInvoices ?? []).filter((inv) => inv.year === year);

                    return (
                      <div
                        key={year}
                        className="grid grid-cols-[repeat(6,minmax(0,1fr))] items-center rounded-md border border-border bg-muted/20 px-4 py-3 text-sm"
                      >
                        <span className="text-center font-semibold tabular-nums">{year}</span>

                        <span className="text-center text-muted-foreground tabular-nums">
                          {yearInvoices.length > 0
                            ? new Date(yearInvoices[0].created_at).toLocaleDateString("nl-NL", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : "—"}
                        </span>

                        <div className="flex flex-col items-center gap-1">
                          {yearInvoices.length > 0
                            ? yearInvoices.map((inv) => {
                                const handleOpen = async (e: React.MouseEvent) => {
                                  e.preventDefault();
                                  if (!inv.invoice_file_path) return;
                                  const { data, error } = await supabase.storage
                                    .from("contribution-invoices")
                                    .createSignedUrl(inv.invoice_file_path, 300);
                                  if (error || !data?.signedUrl) {
                                    toast.error("Factuur kon niet worden geopend");
                                    return;
                                  }
                                  const signedUrl = data.signedUrl.startsWith("http")
                                    ? data.signedUrl
                                    : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1${data.signedUrl}`;
                                  window.open(signedUrl, "_blank", "noopener,noreferrer");
                                };

                                return inv.invoice_file_path ? (
                                  <button
                                    key={inv.id}
                                    onClick={handleOpen}
                                    className="text-primary hover:underline cursor-pointer inline-flex items-center justify-center gap-1 text-sm"
                                    title="Factuur openen"
                                  >
                                    <FileText size={14} />
                                    {inv.invoice_number ?? "—"}
                                  </button>
                                ) : (
                                  <span key={inv.id} className="text-muted-foreground text-sm">
                                    {inv.invoice_number ?? "—"}
                                  </span>
                                );
                              })
                            : <span className="text-muted-foreground text-sm">—</span>}
                        </div>

                        <span className="text-center tabular-nums">
                          € {Number(contrib?.amount ?? 3000).toLocaleString("nl-NL")}
                        </span>

                        <div className="flex justify-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${
                              contrib?.paid ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {contrib?.paid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                            {contrib?.paid ? "Betaald" : "Openstaand"}
                          </span>
                        </div>

                        <span className="text-center text-muted-foreground tabular-nums">
                          {contrib?.paid_date
                            ? new Date(contrib.paid_date).toLocaleDateString("nl-NL", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : "—"}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Locaties */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
              <MapPin size={16} className="text-brand-red" /> Locaties ({member.aantalLocaties})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {member.locaties.map((loc, i) => (
                <div key={i} className="border border-border rounded-md p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium font-display">{loc.naam}</span>
                    {loc.stadsdeel && (
                      <span
                        className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors"
                        onClick={() => navigate(`/locaties/${encodeURIComponent(loc.plaats || member.plaats)}`)}
                      >
                        {loc.stadsdeel}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-sm text-muted-foreground space-y-0.5">
                    {loc.adres && <p>{loc.adres}</p>}
                    <p>
                      {loc.postcode && <>{loc.postcode} </>}
                      {loc.plaats}
                    </p>
                    {loc.kvk && <p className="font-mono text-xs">KVK {loc.kvk}</p>}
                    {loc.oprichtingsDatum && (
                      <p className="text-xs">Opgericht {formatDate(loc.oprichtingsDatum)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aanverwante leden */}
          {member.aanverwant && member.aanverwant.length > 0 && (
            <div className="bg-card rounded-lg border border-border p-5">
              <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
                <Link2 size={16} className="text-brand-red" /> Aanverwant
              </h3>
              <div className="space-y-2">
                {member.aanverwant.map((relId) => {
                  const rel = allMembers.find((m) => m.id === relId);
                  if (!rel) return null;
                  return (
                    <div
                      key={relId}
                      className="flex items-center gap-3 p-3 border border-border rounded-md hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/leden/${relId}`)}
                    >
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold font-mono">
                        {rel.id}
                      </span>
                      <span className="font-medium font-display">{rel.naam}</span>
                      <span className="text-sm text-muted-foreground">{rel.plaats}</span>
                      <ExternalLink size={13} className="ml-auto text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mailingvoorkeuren */}
          {(isAdmin || isOwnProfile) && (
            <MailingPreferences member={member} canEdit={isAdmin || isOwnProfile} />
          )}

          {/* Opmerkingen */}
          {isAdmin && (
            <div className="bg-card rounded-lg border border-border p-5">
              <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
                <MessageSquare size={16} className="text-brand-red" /> Opmerkingen
              </h3>
              <div className="flex gap-2 mb-4">
                <Textarea
                  placeholder="Schrijf een opmerking..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={savingNote || !newNote.trim()}
                  className="shrink-0 self-end"
                >
                  <Send size={14} />
                </Button>
              </div>
              {notes.length > 0 ? (
                <div className="space-y-2">
                  {notes.map((n) => (
                    <div key={n.id} className="flex items-start justify-between gap-2 p-3 bg-muted/30 rounded-md">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(n.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(n.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nog geen opmerkingen</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MemberDetail;
