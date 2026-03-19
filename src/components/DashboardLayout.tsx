import { Outlet } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

const DashboardLayout = () => {
  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 h-12 flex items-center border-b border-border bg-card px-4">
          <SidebarTrigger className="mr-3" />
          <h1 className="text-sm font-semibold font-display text-muted-foreground">Ledenbestand</h1>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
