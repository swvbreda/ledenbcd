import { useState } from "react";
import { LayoutDashboard, Users, MapPin, BarChart3, Menu, X } from "lucide-react";

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "overzicht", label: "Overzicht", icon: LayoutDashboard },
  { id: "leden", label: "Ledenlijst", icon: Users },
  { id: "locaties", label: "Gemeenten", icon: MapPin },
  { id: "statistieken", label: "Statistieken", icon: BarChart3 },
];

const DashboardSidebar = ({ activeTab, onTabChange }: DashboardSidebarProps) => {
  const [open, setOpen] = useState(false);

  const handleNav = (id: string) => {
    onTabChange(id);
    setOpen(false);
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-3 left-3 z-[60] lg:hidden p-2 rounded-md bg-card border border-border"
        aria-label="Menu"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-[49] bg-foreground/20 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-60 bg-sidebar text-sidebar-foreground flex flex-col z-50 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="px-5 py-6 border-b border-sidebar-border">
          <h1 className="text-lg font-bold font-display tracking-tight">BCD Leden</h1>
          <p className="text-xs text-sidebar-muted mt-0.5">Ledenbestand Dashboard</p>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-sidebar-border text-xs text-sidebar-muted">
          113 leden · feb 2026
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;
