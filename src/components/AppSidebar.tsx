import { LayoutDashboard, Users, MapPin, BarChart3, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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
  { title: "Locaties", url: "/locaties", icon: MapPin },
  { title: "Statistieken", url: "/statistieken", icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();

  return (
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-4 py-3 space-y-2">
        {!collapsed && user && (
          <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors w-full"
        >
          <LogOut size={14} />
          {!collapsed && <span>Uitloggen</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
