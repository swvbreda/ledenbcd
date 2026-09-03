import { useRef, useEffect } from "react";
import { Outlet, useLocation, Navigate } from "@/lib/router-compat";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import ScrollToTop from "@/components/ScrollToTop";

const PCN_EMAIL = "info@platformcannabis.nl";
const PCN_SURVEY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const DashboardLayout = () => {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname, search, hash, key } = useLocation();
  const { user, isAdmin } = useAuth();

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

  // PCN user may only access the review page — redirect away from dashboard
  const isPCN = user?.email?.toLowerCase() === PCN_EMAIL && !isAdmin;
  if (isPCN) {
    return <Navigate to={`/enquetes/${PCN_SURVEY_ID}/review`} replace />;
  }

  return (
    <div className="min-h-screen flex w-full overflow-x-hidden max-w-[100vw]">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="sticky top-0 z-40 flex items-center border-b border-border bg-card px-4 pt-[env(safe-area-inset-top)] h-[calc(5rem+env(safe-area-inset-top))]">
          <SidebarTrigger className="mr-3" />
        </header>
        <main ref={mainRef} id="main-scroll-area" className="flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
        <ScrollToTop />
      </div>
    </div>
  );
};

export default DashboardLayout;
