import { useRef, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

const DashboardLayout = () => {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname, search, hash, key } = useLocation();

  useEffect(() => {
    const resetScroll = () => {
      mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetScroll();
    requestAnimationFrame(resetScroll);
  }, [pathname, search, hash, key]);

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex items-center border-b border-border bg-card px-4 pt-[env(safe-area-inset-top)] h-[calc(3rem+env(safe-area-inset-top))]">
          <SidebarTrigger className="mr-3" />
          <h1 className="text-sm font-semibold font-display text-muted-foreground">Ledenbestand</h1>
        </header>
        <main ref={mainRef} className="flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
