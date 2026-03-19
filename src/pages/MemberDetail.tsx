import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Mail, Phone, FileText, Users, Calendar, Hash, Globe, Instagram, ExternalLink, Shield, Lock, UserCheck, Archive, ArchiveRestore, Link2, Pencil, MessageSquare, Send, Trash2 } from "lucide-react";
import { allMembers } from "@/hooks/useMembers";
import { getMembershipYears } from "@/lib/membership";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { archiveMember, restoreMember, isArchived } from "@/hooks/useArchive";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMergedMember } from "@/hooks/useMemberEdits";
import MemberEditForm from "@/components/MemberEditForm";
import MailingPreferences from "@/components/MailingPreferences";

const getStoredContactpersoon = (memberId: number): string | null => {
  try {
    return localStorage.getItem(`bcd-contactpersoon-${memberId}`);
  } catch { return null; }
};

const setStoredContactpersoon = (memberId: number, naam: string | null) => {
  try {
    if (naam) localStorage.setItem(`bcd-contactpersoon-${memberId}`, naam);
    else localStorage.removeItem(`bcd-contactpersoon-${memberId}`);
  } catch {}
};

const MemberDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, linkedMemberId } = useAuth();
  const isOwnProfile = linkedMemberId !== null && linkedMemberId === Number(id);
  const canSeeDetails = isAdmin || isOwnProfile;
  const memberId = Number(id);
  const { member, isLoading } = useMergedMember(memberId);

  const defaultCp = member ? (getStoredContactpersoon(member.id) ?? member.contactpersoon) : "";
  const [contactpersoon, setContactpersoon] = useState(defaultCp);
  const [archived, setArchived] = useState(() => member ? isArchived(member.id) : false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState<{ id: string; note: string; created_at: string }[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

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
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-3 sm:gap-4">
        <button
          onClick={() => navigate(-1)}
          className="mt-1 p-1.5 sm:p-2 rounded-md hover:bg-muted transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
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
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} /> {member.plaats}
            </span>
            {member.stadsdeel && (
              <span className="px-2 py-0.5 bg-muted rounded text-xs">{member.stadsdeel}</span>
            )}
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
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="flex items-center gap-2 flex-wrap -mt-2">
          {!editing && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Bewerken
            </Button>
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
                    onClick={() => {
                      if (archived) {
                        restoreMember(member.id);
                        setArchived(false);
                        toast.success(`${member.naam} is hersteld`);
                      } else {
                        archiveMember(member.id);
                        setArchived(true);
                        toast.success(`${member.naam} is gearchiveerd`);
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

      {/* Edit mode */}
      {editing && isAdmin ? (
        <MemberEditForm member={member} editing={editing} setEditing={setEditing} />
      ) : (
        <>
          {/* Oprichting & KVK */}
          {(member.oprichtingsDatum || member.oprichtingJaar || member.lidSinds) && (
            <div className="bg-card rounded-lg border border-border p-5 flex flex-wrap gap-6">
              {(member.oprichtingsDatum || member.oprichtingJaar) && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={16} className="text-primary" />
                  <span className="text-muted-foreground">Opgericht:</span>
                  <span className="font-medium">
                    {member.oprichtingsDatum
                      ? formatDate(member.oprichtingsDatum)
                      : member.oprichtingJaar}
                  </span>
                </div>
              )}
              {member.lidSinds && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={16} className="text-success" />
                  <span className="text-muted-foreground">Lid sinds:</span>
                  <span className="font-medium">{member.lidSinds}</span>
                  <span className="text-xs text-muted-foreground">
                    ({new Date().getFullYear() - member.lidSinds} jaar)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Website & Social Media */}
          {(member.website || member.instagram || member.facebook) && (
            <div className="bg-card rounded-lg border border-border p-5">
              <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-3">
                <Globe size={16} className="text-primary" /> Online
              </h3>
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
            </div>
          )}

          {canSeeDetails ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contactpersonen */}
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
                  <Users size={16} className="text-primary" /> Contactpersonen ({member.contacten.length})
                </h3>
                <div className="space-y-4">
                  {member.contacten.length > 0 ? (
                    member.contacten.map((c, i) => {
                      const isSelected = contactpersoon === c.naam;
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
                                        const newVal = checked ? c.naam : "";
                                        setContactpersoon(newVal);
                                        setStoredContactpersoon(member.id, newVal || null);
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
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">Geen contactpersonen bekend</p>
                  )}
                </div>
              </div>

              {/* Factuurgegevens */}
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
                  <FileText size={16} className="text-primary" /> Factuurgegevens
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
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border p-5 flex items-center gap-3 text-muted-foreground">
              <Lock size={16} />
              <p className="text-sm">Contactgegevens en factuurgegevens zijn alleen zichtbaar voor het eigen profiel en bestuursleden.</p>
            </div>
          )}

          {/* Locaties */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
              <MapPin size={16} className="text-primary" /> Locaties ({member.aantalLocaties})
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
                  <div className="mt-1.5 text-sm text-muted-foreground">
                    {loc.adres && <p>{loc.adres}</p>}
                    <p>
                      {loc.postcode && <>{loc.postcode} </>}
                      {loc.plaats}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aanverwante leden */}
          {member.aanverwant && member.aanverwant.length > 0 && (
            <div className="bg-card rounded-lg border border-border p-5">
              <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
                <Link2 size={16} className="text-primary" /> Aanverwant
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

          {/* Opmerkingen */}
          {isAdmin && (
            <div className="bg-card rounded-lg border border-border p-5">
              <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
                <MessageSquare size={16} className="text-primary" /> Opmerkingen
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
