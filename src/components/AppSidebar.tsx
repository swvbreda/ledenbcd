import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, MapPin, BarChart3, LogOut, Shield, KeyRound, UserMinus, ClipboardCheck, UserCog, UserCircle, ClipboardList, Building2, Gift, Wallet, FileLock2, Mail } from "lucide-react";
import bcdLogo from "@/assets/bcd-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { NavLink } from "@/components/NavLink";
import { supabase } from "@/integrations/supabase/client";
import { useEditRequests } from "@/hooks/useMemberEdits";
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
  { title: "Ledenbestand", url: "/leden", icon: Users },
  { title: "Gemeenten", url: "/locaties", icon: MapPin },
  { title: "Enquêtes", url: "/enquetes", icon: ClipboardList },
  { title: "Ledenvoordelen", url: "/ledenvoordelen", icon: Gift },
  { title: "Jaarplan", url: "/jaarplan", icon: FileLock2 },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const closeMobile = () => setOpenMobile(false);
  const { user, isAdmin, signOut } = useAuth();
  const { data: pendingRequests } = useEditRequests("pending");
  const pendingCount = isAdmin ? (pendingRequests?.length ?? 0) : 0;
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
        <SidebarHeader className="border-b border-sidebar-border px-3 py-3 bg-white pt-[max(0.75rem,env(safe-area-inset-top))] cursor-pointer" onClick={() => { navigate("/"); closeMobile(); }}>
          {!collapsed ? (
            <img src={bcdLogo} alt="Bond van Cannabis Detaillisten" className="h-14 w-auto object-contain" />
          ) : (
            <img src={bcdLogo} alt="BCD" className="h-8 w-8 object-contain" />
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
                        onClick={closeMobile}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {isAdmin && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to="/goedkeuringen"
                          className="hover:bg-sidebar-accent/50"
                          activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                          onClick={closeMobile}
                        >
                          <ClipboardCheck className="mr-2 h-4 w-4" />
                          {!collapsed && (
                            <span className="flex items-center gap-2">
                              Goedkeuringen
                              {pendingCount > 0 && (
                                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                                  {pendingCount}
                                </span>
                              )}
                            </span>
                          )}
                          {collapsed && pendingCount > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to="/accounts"
                          className="hover:bg-sidebar-accent/50"
                          activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                          onClick={closeMobile}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Accounts</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to="/bestuur-beheer"
                          className="hover:bg-sidebar-accent/50"
                          activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                          onClick={closeMobile}
                        >
                          <UserCog className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Bestuur</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to="/financien"
                          className="hover:bg-sidebar-accent/50"
                          activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                          onClick={closeMobile}
                        >
                          <Wallet className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Financiën</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to="/externe-partijen"
                          className="hover:bg-sidebar-accent/50"
                          activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                          onClick={closeMobile}
                        >
                          <Building2 className="mr-2 h-4 w-4" />
                          {!collapsed && <span>Externe partijen</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to="/email-templates"
                          className="hover:bg-sidebar-accent/50"
                          activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                          onClick={closeMobile}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          {!collapsed && <span>E-mailtemplates</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Account</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/mijn-account"
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                      onClick={closeMobile}
                    >
                      <UserCircle className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Mijn Account</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Community</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a
                      href="https://chat.whatsapp.com/I9wCzDQE07KJZZjycFT3cU"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:bg-sidebar-accent/50"
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      {!collapsed && <span>WhatsApp Community</span>}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border px-4 py-3 space-y-2">
          {!collapsed && user && (
            <div className="flex items-center gap-1.5">
              {isAdmin && <Shield size={12} className="text-brand-red shrink-0" />}
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
