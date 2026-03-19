import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { allMembersAndLeads } from "@/hooks/useMembers";
import { toast } from "sonner";
import { Shield, Trash2, UserPlus, Loader2, Search, X, ExternalLink } from "lucide-react";
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

  // Board members data for @coffeeshopbond.nl matching
  const boardMembers = useMemo(() => [
    { naam: "Simone van Breda", functie: "Voorzitter", bondEmail: "simone@coffeeshopbond.nl" },
    { naam: "Joachim Helms", functie: "Bestuurder / Woordvoerder", bondEmail: "joachim@coffeeshopbond.nl" },
    { naam: "Bernard van Nierop", functie: "Bestuurder / Penningmeester", bondEmail: "bernard@coffeeshopbond.nl" },
    { naam: "Huub van den Brink", functie: "Bestuurder", bondEmail: "huub@coffeeshopbond.nl" },
    { naam: "Dorine Buchener", functie: "Bestuurder", bondEmail: "dorine@coffeeshopbond.nl" },
    { naam: "Stef Couwenberg", functie: "Bestuurder", bondEmail: "stef@coffeeshopbond.nl" },
    { naam: "Hannes Poppinghaus", functie: "Woordvoerder Arnhem", bondEmail: "arnhem@coffeeshopbond.nl" },
    { naam: "Tugrulhan", functie: "Woordvoerder Enschede", bondEmail: "enschede@coffeeshopbond.nl" },
  ], []);

  // Build member name lookup
  const memberNameMap = useMemo(() => {
    const map = new Map<number, string>();
    allMembersAndLeads.forEach((m) => map.set(m.id, m.naam));
    return map;
  }, []);

  const getDisplayName = (u: UserAccount): { name: string | null; isBoardMember: boolean; functie?: string } => {
    // Check board member first (by email)
    if (u.email) {
      const board = boardMembers.find(b => b.bondEmail.toLowerCase() === u.email.toLowerCase());
      if (board) return { name: board.naam, isBoardMember: true, functie: board.functie };
    }
    // Fall back to member lookup
    if (u.member_id) {
      const name = memberNameMap.get(u.member_id) || null;
      return { name, isBoardMember: false };
    }
    return { name: null, isBoardMember: false };
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter((u) => {
      const { name } = getDisplayName(u);
      const displayName = name || "";
      return (
        (u.email || "").toLowerCase().includes(q) ||
        displayName.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, memberNameMap]);

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
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek op naam of e-mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8 h-9 w-56 text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
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
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Naam</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">E-mail</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Rol</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Laatste login</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const { name: displayName, isBoardMember, functie } = getDisplayName(u);
                  return (
                    <tr key={u.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {displayName ? (
                            isBoardMember ? (
                              <span className="inline-flex items-center gap-1">
                                <Shield size={12} className="text-primary" />
                                {displayName}
                                {functie && <span className="text-[10px] text-muted-foreground">({functie})</span>}
                              </span>
                            ) : (
                              <button
                                onClick={() => navigate(`/leden/${u.member_id}`)}
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                {displayName}
                                <ExternalLink size={12} className="opacity-50" />
                              </button>
                            )
                          ) : (
                            <span className="text-muted-foreground italic">Geen koppeling</span>
                          )}
                          {u.id === user?.id && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-semibold">Jij</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          u.role === "admin"
                            ? "bg-accent/15 text-accent-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {u.role === "admin" && <Shield size={11} />}
                          {u.role === "admin" ? "Admin" : "Gebruiker"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(u.last_sign_in_at)}</td>
                      <td className="px-4 py-3">
                        {u.id !== user?.id && (
                          <button
                            onClick={() => setDeleteId(u.id)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
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
    </div>
  );
};

export default AccountBeheerPage;
