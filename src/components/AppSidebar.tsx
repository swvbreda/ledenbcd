import { useState } from "react";
import { LayoutDashboard, Users, MapPin, BarChart3, LogOut, Shield, KeyRound, UserMinus, PieChart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NavLink } from "@/components/NavLink";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Overzicht", url: "/", icon: LayoutDashboard },
  { title: "Ledenlijst", url: "/leden", icon: Users },
  { title: "Oud-leden", url: "/oud-leden", icon: UserMinus },
  { title: "Gemeenten", url: "/locaties", icon: MapPin },
  { title: "Statistieken", url: "/statistieken", icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, isAdmin, signOut } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPw.length < 8) {
      toast.error("Wachtwoord moet minimaal 8 tekens zijn");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Wachtwoorden komen niet overeen");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) {
      toast.error("Fout bij wijzigen: " + error.message);
    } else {
      toast.success("Wachtwoord succesvol gewijzigd");
      setPwOpen(false);
      setNewPw("");
      setConfirmPw("");
    }
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
          {!collapsed ? (
            <>
              <h1 className="text-lg font-bold font-display tracking-tight text-sidebar-foreground">
                BCD Leden
              </h1>
              <p className="text-xs text-sidebar-foreground/60 mt-0.5">Ledenbestand Dashboard</p>
            </>
          ) : (
            <span className="text-lg font-bold text-sidebar-foreground">B</span>
          )}
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigatie</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/accounts"
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        {!collapsed && <span>Accounts</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border px-4 py-3 space-y-2">
          {!collapsed && user && (
            <div className="flex items-center gap-1.5">
              {isAdmin && <Shield size={12} className="text-primary shrink-0" />}
              <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={() => setPwOpen(true)}
            className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors w-full"
          >
            <KeyRound size={14} />
            {!collapsed && <span>Wachtwoord wijzigen</span>}
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors w-full"
          >
            <LogOut size={14} />
            {!collapsed && <span>Uitloggen</span>}
          </button>
        </SidebarFooter>
      </Sidebar>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wachtwoord wijzigen</DialogTitle>
            <DialogDescription>Kies een nieuw wachtwoord (minimaal 8 tekens).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              type="password"
              placeholder="Nieuw wachtwoord"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Bevestig wachtwoord"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
            <Button onClick={handleChangePassword} disabled={saving} className="w-full">
              {saving ? "Opslaan..." : "Wachtwoord opslaan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
