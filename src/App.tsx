import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import DashboardLayout from "@/components/DashboardLayout";
import Index from "./pages/Index";
import MemberDetail from "./pages/MemberDetail";
import LedenPage from "./pages/LedenPage";
import LocatiesPage from "./pages/LocatiesPage";
import StatistiekenPage from "./pages/StatistiekenPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SidebarProvider>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/leden" element={<LedenPage />} />
              <Route path="/leden/:id" element={<MemberDetail />} />
              <Route path="/locaties" element={<LocatiesPage />} />
              <Route path="/statistieken" element={<StatistiekenPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
