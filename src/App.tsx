import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import Index from "./pages/Index";
import MemberDetail from "./pages/MemberDetail";
import LedenPage from "./pages/LedenPage";
import LocatiesPage from "./pages/LocatiesPage";
import StatistiekenPage from "./pages/StatistiekenPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AccountBeheerPage from "./pages/AccountBeheerPage";
import OudLedenPage from "./pages/OudLedenPage";
import MarktaandeelPage from "./pages/MarktaandeelPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SidebarProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Index />} />
                <Route path="/leden" element={<LedenPage />} />
                <Route path="/leden/:id" element={<MemberDetail />} />
                <Route path="/locaties" element={<LocatiesPage />} />
                <Route path="/statistieken" element={<StatistiekenPage />} />
                <Route path="/accounts" element={<AccountBeheerPage />} />
                <Route path="/oud-leden" element={<OudLedenPage />} />
                <Route path="/marktaandeel" element={<MarktaandeelPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SidebarProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
