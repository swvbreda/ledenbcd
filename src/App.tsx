import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/hooks/useAuth";
import { MembersDataProvider } from "@/contexts/MembersDataContext";
import { PushNotificationInit } from "@/components/PushNotificationInit";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import Index from "./pages/Index";
import MemberDetail from "./pages/MemberDetail";
import LedenPage from "./pages/LedenPage";
import LocatiesPage from "./pages/LocatiesPage";
import GemeenteDetailPage from "./pages/GemeenteDetailPage";
import StatistiekenPage from "./pages/StatistiekenPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AccountBeheerPage from "./pages/AccountBeheerPage";
import GoedkeuringenPage from "./pages/GoedkeuringenPage";
import BestuurBeheerPage from "./pages/BestuurBeheerPage";
import MijnAccountPage from "./pages/MijnAccountPage";
import EnquetesPage from "./pages/EnquetesPage";
import EnqueteInvullenPage from "./pages/EnqueteInvullenPage";
import EnqueteBeheerPage from "./pages/EnqueteBeheerPage";
import EnqueteExternPage from "./pages/EnqueteExternPage";
import EnqueteReviewPage from "./pages/EnqueteReviewPage";
import ContributiePage from "./pages/ContributiePage";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <MembersDataProvider>
        <TooltipProvider>
          <PushNotificationInit />
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
                  <Route path="/locaties/:gemeente" element={<GemeenteDetailPage />} />
                  <Route path="/statistieken" element={<StatistiekenPage />} />
                  <Route path="/accounts" element={<AccountBeheerPage />} />
                  <Route path="/goedkeuringen" element={<GoedkeuringenPage />} />
                  <Route path="/bestuur-beheer" element={<BestuurBeheerPage />} />
                  <Route path="/mijn-account" element={<MijnAccountPage />} />
                  <Route path="/enquetes" element={<EnquetesPage />} />
                  <Route path="/enquetes/:id" element={<EnqueteInvullenPage />} />
                  <Route path="/enquetes/:id/beheer" element={<EnqueteBeheerPage />} />
                  <Route path="/oud-leden" element={<LedenPage />} />
                  <Route path="/marktaandeel" element={<LocatiesPage />} />
                  <Route path="/contributie" element={<ContributiePage />} />
                </Route>
                <Route path="/enquete-extern/:id" element={<EnqueteExternPage />} />
                <Route path="/enquetes/pcnleden" element={<EnqueteExternPage />} />
                <Route
                  path="/enquetes/:id/review"
                  element={
                    <ProtectedRoute>
                      <EnqueteReviewPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SidebarProvider>
          </BrowserRouter>
        </TooltipProvider>
      </MembersDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
