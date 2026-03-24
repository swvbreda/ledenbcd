import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMembersData } from "@/contexts/MembersDataContext";
import { toast } from "sonner";
import { Shield, Trash2, UserPlus, Loader2, Search, X, ExternalLink, Link, Unlink, Pencil, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserAccount {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: string;
  member_id: number | null;
  member_ids: number[];
}

const AccountBeheerPage = () => {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [linkDialogUser, setLinkDialogUser] = useState<UserAccount | null>(null);
  const [linkMemberId, setLinkMemberId] = useState("");
  const [linkSearch, setLinkSearch] = useState("");
  const [editUser, setEditUser] = useState<UserAccount | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [resetPwUser, setResetPwUser] = useState<UserAccount | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetPwConfirm, setResetPwConfirm] = useState("");

  const { allMembersAndLeads } = useMembersData();
  const memberMap = useMemo(() => {
    const map = new Map<number, typeof allMembersAndLeads[0]>();
    allMembersAndLeads.forEach((m) => map.set(m.id, m));
    return map;
  }, [allMembersAndLeads]);

  const isBoardEmail = (email: string | undefined) =>
    !!email && email.toLowerCase().endsWith("@coffeeshopbond.nl");

  const boardNameMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set("simone@coffeeshopbond.nl", "Simone van Breda");
    map.set("joachim@coffeeshopbond.nl", "Joachim Helms");
    map.set("bernard@coffeeshopbond.nl", "Bernard van Nierop");
    map.set("huub@coffeeshopbond.nl", "Huub van den Brink");
    map.set("dorine@coffeeshopbond.nl", "Dorine Buchener");
    map.set("stef@coffeeshopbond.nl", "Stef Couwenberg");
    map.set("arnhem@coffeeshopbond.nl", "Hannes Poppinghaus");
    map.set("enschede@coffeeshopbond.nl", "Tugrulhan");
    map.set("info@coffeeshopbond.nl", "Secretariaat");
    map.set("bestuur@coffeeshopbond.nl", "Bestuur");
    return map;
  }, []);

  const getDisplayInfo = (u: UserAccount): { label: string; personName: string; isBoard: boolean; memberIds: number[] } => {
    const ids = u.member_ids || (u.member_id ? [u.member_id] : []);
    if (isBoardEmail(u.email)) {
      const name = boardNameMap.get(u.email.toLowerCase()) || u.email.split("@")[0];
      return { label: "Bestuur", personName: name, isBoard: true, memberIds: ids };
    }
    if (ids.length > 0) {
      const firstMember = memberMap.get(ids[0]);
      return { label: firstMember?.naam || "Onbekend lid", personName: firstMember?.contactpersoon || "", isBoard: false, memberIds: ids };
    }
    return { label: "", personName: "", isBoard: false, memberIds: [] };
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter((u) => {
      const { label } = getDisplayInfo(u);
      const displayName = label || "";
      return (
        (u.email || "").toLowerCase().includes(q) ||
        displayName.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, memberMap]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list" },
      });
      if (error) {
        toast.error("Fout bij ophalen accounts: " + error.message);
        setUsers([]);
      } else if (data?.error) {
        toast.error("Fout bij ophalen accounts: " + data.error);
        setUsers([]);
      } else {
        setUsers(data?.users || []);
      }
    } catch (e: any) {
      toast.error("Fout bij ophalen accounts: " + (e?.message || "Onbekende fout"));
      setUsers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) { navigate("/"); return; }
    fetchUsers();
  }, [isAdmin, navigate]);

  const handleCreate = async () => {
    if (!newEmail || !newPassword) { toast.error("Vul e-mail en wachtwoord in"); return; }
    if (newPassword.length < 8) { toast.error("Wachtwoord moet minimaal 8 tekens zijn"); return; }
    setSaving(true);
    const { error } = await supabase.functions.invoke("manage-users", {
      body: { action: "create", email: newEmail, password: newPassword, role: newRole },
    });
    setSaving(false);
    if (error) { toast.error("Fout bij aanmaken: " + error.message); return; }
    toast.success("Account aangemaakt");
    setCreateOpen(false);
    setNewEmail(""); setNewPassword(""); setNewRole("user");
    fetchUsers();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.functions.invoke("manage-users", {
      body: { action: "delete", user_id: deleteId },
    });
    if (error) { toast.error("Fout bij verwijderen: " + error.message); }
    else { toast.success("Account verwijderd"); fetchUsers(); }
    setDeleteId(null);
  };

  const handleLink = async () => {
    if (!linkDialogUser || !linkMemberId) return;
    const mid = parseInt(linkMemberId);
    if (isNaN(mid)) { toast.error("Voer een geldig lidnummer in"); return; }
    setSaving(true);
    const { error } = await supabase.functions.invoke("manage-users", {
      body: { action: "link_member", user_id: linkDialogUser.id, member_id: mid },
    });
    setSaving(false);
    if (error) { toast.error("Fout bij koppelen: " + error.message); return; }
    toast.success(`Lid #${mid} gekoppeld`);
    setLinkDialogUser(null);
    setLinkMemberId("");
    fetchUsers();
  };

  const handleUnlink = async (userId: string, memberId: number) => {
    const { error } = await supabase.functions.invoke("manage-users", {
      body: { action: "unlink_member", user_id: userId, member_id: memberId },
    });
    if (error) { toast.error("Fout bij ontkoppelen: " + error.message); return; }
    toast.success(`Lid #${memberId} ontkoppeld`);
    fetchUsers();
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    const body: Record<string, unknown> = { action: "update_user", user_id: editUser.id };
    if (editEmail && editEmail !== editUser.email) body.email = editEmail;
    if (editRole !== editUser.role) body.role = editRole;
    const { error } = await supabase.functions.invoke("manage-users", { body });
    setSaving(false);
    if (error) { toast.error("Fout bij opslaan: " + error.message); return; }
    toast.success("Account bijgewerkt");
    setEditUser(null);
    fetchUsers();
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("nl-NL", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  if (!isAdmin) return null;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display">Accountbeheer</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredUsers.length}{searchQuery ? ` van ${users.length}` : ""} accounts
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek op naam of e-mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8 h-9 w-full sm:w-56 text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5 shrink-0">
            <UserPlus size={15} /> Nieuw account
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-left font-semibold text-muted-foreground text-xs sm:text-sm">Koppeling</th>
                  <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-left font-semibold text-muted-foreground text-xs sm:text-sm">Naam</th>
                  <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-left font-semibold text-muted-foreground hidden sm:table-cell">E-mail</th>
                  <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Rol</th>
                  <th className="px-2 sm:px-4 py-2.5 sm:py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">Laatste login</th>
                  <th className="px-1 sm:px-4 py-2.5 sm:py-3 w-12 sm:w-16" />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const { label, personName, isBoard, memberIds } = getDisplayInfo(u);
                  return (
                    <tr key={u.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-xs sm:text-sm">
                        <div className="flex flex-col gap-1">
                          {isBoard ? (
                            <span className="inline-flex items-center gap-1">
                              <Shield size={10} className="text-primary sm:hidden" /><Shield size={12} className="text-primary hidden sm:inline" />
                              {label}
                            </span>
                          ) : memberIds.length > 0 ? (
                            memberIds.map((mid) => {
                              const m = memberMap.get(mid);
                              return (
                                <span key={mid} className="inline-flex items-center gap-1">
                                  <button
                                    onClick={() => navigate(`/leden/${mid}`)}
                                    className="inline-flex items-center gap-1 text-primary hover:underline text-left"
                                  >
                                    <span className="text-muted-foreground text-[10px] font-mono">#{mid}</span>
                                    <span className="line-clamp-1">{m?.naam || "Onbekend lid"}</span>
                                    <ExternalLink size={10} className="opacity-50 hidden sm:inline shrink-0" />
                                  </button>
                                  <button
                                    onClick={() => handleUnlink(u.id, mid)}
                                    className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors hidden sm:inline-flex"
                                    title="Koppeling verwijderen"
                                  >
                                    <Unlink size={10} />
                                  </button>
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-muted-foreground italic">Geen koppeling</span>
                          )}
                          {u.id === user?.id && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-semibold w-fit">Jij</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-muted-foreground text-xs sm:text-sm">
                        {personName || "—"}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-muted-foreground break-all hidden sm:table-cell">{u.email}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          u.role === "admin"
                            ? "bg-accent/15 text-accent-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {u.role === "admin" && <Shield size={11} />}
                          {u.role === "admin" ? "Admin" : "Gebruiker"}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-muted-foreground hidden lg:table-cell">{formatDate(u.last_sign_in_at)}</td>
                      <td className="px-1 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          <button
                            onClick={() => { setEditUser(u); setEditEmail(u.email); setEditRole(u.role); }}
                            className="p-1 sm:p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Bewerken"
                          >
                            <Pencil size={12} className="sm:hidden" /><Pencil size={14} className="hidden sm:block" />
                          </button>
                          {u.id !== user?.id && (
                            <button
                              onClick={() => setDeleteId(u.id)}
                              className="p-1 sm:p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 size={12} className="sm:hidden" /><Trash2 size={14} className="hidden sm:block" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery ? "Geen accounts gevonden voor deze zoekopdracht" : "Geen accounts gevonden"}
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nieuw account aanmaken</DialogTitle>
            <DialogDescription>Maak een nieuw gebruikersaccount aan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input type="email" placeholder="E-mailadres" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Input type="password" placeholder="Wachtwoord (min. 8 tekens)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Gebruiker</SelectItem>
                <SelectItem value="admin">Admin (bestuurslid)</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleCreate} disabled={saving} className="w-full">
              {saving ? "Aanmaken..." : "Account aanmaken"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert het account permanent. Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link member dialog */}
      <Dialog open={!!linkDialogUser} onOpenChange={(open) => { if (!open) setLinkDialogUser(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Lid koppelen</DialogTitle>
            <DialogDescription>
              Koppel een lidmaatschapsnummer aan {linkDialogUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Zoek op naam of lidnummer..."
              value={linkSearch}
              onChange={(e) => {
                setLinkSearch(e.target.value);
                // If pure number, also set as member id
                const num = parseInt(e.target.value);
                if (!isNaN(num) && String(num) === e.target.value.trim()) {
                  setLinkMemberId(e.target.value);
                } else {
                  setLinkMemberId("");
                }
              }}
            />
            {(() => {
              if (!linkSearch.trim()) return null;
              const q = linkSearch.toLowerCase();
              const matches = allMembersAndLeads
                .filter((m) =>
                  m.naam.toLowerCase().includes(q) ||
                  m.contactpersoon.toLowerCase().includes(q) ||
                  m.bedrijfsnaam.toLowerCase().includes(q) ||
                  String(m.id).includes(q)
                )
                .slice(0, 8);
              if (matches.length === 0) return (
                <p className="text-sm text-muted-foreground">Geen resultaten</p>
              );
              return (
                <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                  {matches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setLinkMemberId(String(m.id));
                        setLinkSearch(`#${m.id} ${m.naam}`);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between ${
                        linkMemberId === String(m.id) ? "bg-primary/5" : ""
                      }`}
                    >
                      <span>
                        <span className="text-muted-foreground font-mono text-xs">#{m.id}</span>{" "}
                        <span className="font-medium">{m.naam}</span>
                        <span className="text-muted-foreground ml-1.5">— {m.contactpersoon}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{m.plaats}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
            <Button onClick={handleLink} disabled={saving || !linkMemberId} className="w-full gap-1.5">
              <Link size={14} />
              {saving ? "Koppelen..." : "Koppelen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Account bewerken</DialogTitle>
            <DialogDescription>
              Wijzig de gegevens van dit account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">E-mailadres</label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rol</label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Gebruiker</SelectItem>
                  <SelectItem value="admin">Admin (bestuurslid)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editUser && (() => {
              const { memberIds } = getDisplayInfo(editUser);
              return (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Koppeling</label>
                  {memberIds.length > 0 ? (
                    <div className="space-y-1">
                      {memberIds.map((mid) => {
                        const m = memberMap.get(mid);
                        return (
                          <div key={mid} className="flex items-center justify-between text-sm">
                            <button
                              onClick={() => navigate(`/leden/${mid}`)}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <span className="text-muted-foreground text-[11px] font-mono">#{mid}</span>
                              {m?.naam || "Onbekend lid"}
                              <ExternalLink size={10} className="opacity-50" />
                            </button>
                            <button
                              onClick={() => handleUnlink(editUser.id, mid)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Ontkoppelen"
                            >
                              <Unlink size={12} />
                            </button>
                          </div>
                        );
                      })}
                      <p className="text-xs text-muted-foreground">
                        De weergavenaam komt van het gekoppelde lid.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Geen koppeling</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 w-full"
                    onClick={() => { setEditUser(null); setLinkDialogUser(editUser); setLinkMemberId(""); setLinkSearch(""); }}
                  >
                    <Link size={12} /> Lid koppelen
                  </Button>
                </div>
              );
            })()}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 w-full"
              onClick={() => { setResetPwUser(editUser); setResetPw(""); setResetPwConfirm(""); }}
            >
              <KeyRound size={12} /> Wachtwoord resetten
            </Button>
            <Button onClick={handleEdit} disabled={saving} className="w-full">
              {saving ? "Opslaan..." : "Opslaan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetPwUser} onOpenChange={(open) => { if (!open) setResetPwUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wachtwoord resetten</DialogTitle>
            <DialogDescription>
              Stel een nieuw wachtwoord in voor {resetPwUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              type="password"
              placeholder="Nieuw wachtwoord (min. 8 tekens)"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Bevestig wachtwoord"
              value={resetPwConfirm}
              onChange={(e) => setResetPwConfirm(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={saving || resetPw.length < 8 || resetPw !== resetPwConfirm}
              onClick={async () => {
                if (resetPw.length < 8) { toast.error("Wachtwoord moet minimaal 8 tekens zijn"); return; }
                if (resetPw !== resetPwConfirm) { toast.error("Wachtwoorden komen niet overeen"); return; }
                setSaving(true);
                const { error } = await supabase.functions.invoke("manage-users", {
                  body: { action: "reset_password", user_id: resetPwUser!.id, password: resetPw },
                });
                setSaving(false);
                if (error) { toast.error("Fout bij resetten: " + error.message); return; }
                toast.success("Wachtwoord succesvol gewijzigd");
                setResetPwUser(null);
              }}
            >
              {saving ? "Opslaan..." : "Wachtwoord opslaan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountBeheerPage;
