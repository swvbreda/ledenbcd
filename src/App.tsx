import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import CommunityPage from "./pages/CommunityPage";
import FinancienPage from "./pages/FinancienPage";
import JaarplanPage from "./pages/JaarplanPage";
import AgendaPage from "./pages/AgendaPage";
import CoffeeshopRegisterPage from "./pages/CoffeeshopRegisterPage";
import RegisterGemeenteDetailPage from "./pages/RegisterGemeenteDetailPage";
import KerngegevensPage from "./pages/KerngegevensPage";
import LocatiesPage from "./pages/LocatiesPage";
import GemeenteDetailPage from "./pages/GemeenteDetailPage";

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

import ExternLoginPage from "./pages/ExternLoginPage";
import ExternDashboardPage from "./pages/ExternDashboardPage";
import ExternePartijenPage from "./pages/ExternePartijenPage";
import ExternePartijDetailPage from "./pages/ExternePartijDetailPage";
import LedenvoordelenPage from "./pages/LedenvoordelenPage";
import ExternProfielPage from "./pages/ExternProfielPage";
import ExternProductDetailPage from "./pages/ExternProductDetailPage";
import BenefitDetailPage from "./pages/BenefitDetailPage";
import ExternGemeenteDetailPage from "./pages/ExternGemeenteDetailPage";
import MfaSetupPage from "./pages/MfaSetupPage";
import MfaVerifyPage from "./pages/MfaVerifyPage";
import ExternProtectedRoute from "@/components/ExternProtectedRoute";
import EmailTemplatesPage from "./pages/EmailTemplatesPage";
import UnsubscribePage from "./pages/UnsubscribePage";
import CheckoutReturn from "./pages/CheckoutReturn";

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
                <Route path="/extern-login" element={<ExternLoginPage />} />
                <Route path="/extern" element={<ExternProtectedRoute><ExternDashboardPage /></ExternProtectedRoute>} />
                <Route path="/extern/profiel" element={<ExternProtectedRoute><ExternProfielPage /></ExternProtectedRoute>} />
                <Route path="/extern/product/:id" element={<ExternProtectedRoute><ExternProductDetailPage /></ExternProtectedRoute>} />
                <Route path="/extern/gemeente/:gemeente" element={<ExternProtectedRoute><ExternGemeenteDetailPage /></ExternProtectedRoute>} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/mfa-setup" element={<MfaSetupPage />} />
                <Route path="/mfa-verify" element={<MfaVerifyPage />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Index />} />
                  <Route path="/leden" element={<LedenPage />} />
                  <Route path="/leden-betalingen" element={<Navigate to="/financien" replace />} />
                  <Route path="/leden/:id" element={<MemberDetail />} />
                  <Route path="/community" element={<CommunityPage />} />
                  <Route path="/locaties" element={<LocatiesPage />} />
                  <Route path="/locaties/:gemeente" element={<GemeenteDetailPage />} />
                  
                  <Route path="/accounts" element={<AccountBeheerPage />} />
                  <Route path="/goedkeuringen" element={<GoedkeuringenPage />} />
                  <Route path="/bestuur-beheer" element={<BestuurBeheerPage />} />
                  <Route path="/mijn-account" element={<MijnAccountPage />} />
                  <Route path="/enquetes" element={<EnquetesPage />} />
                  <Route path="/enquetes/:id" element={<EnqueteInvullenPage />} />
                  <Route path="/enquetes/:id/beheer" element={<EnqueteBeheerPage />} />
                  
                  <Route path="/externe-partijen" element={<ExternePartijenPage />} />
                  <Route path="/externe-partijen/:id" element={<ExternePartijDetailPage />} />
                  <Route path="/ledenvoordelen" element={<LedenvoordelenPage />} />
                  <Route path="/ledenvoordelen/:id" element={<BenefitDetailPage />} />
                  <Route path="/financien" element={<FinancienPage />} />
                  <Route path="/agenda" element={<AgendaPage />} />
                  <Route path="/agenda/:eventId" element={<AgendaPage />} />
                  <Route path="/coffeeshopregister" element={<CoffeeshopRegisterPage />} />
                  <Route path="/coffeeshopregister/gemeente/:gemeente" element={<RegisterGemeenteDetailPage />} />
                  <Route path="/kerngegevens" element={<KerngegevensPage />} />
                  <Route path="/jaarplan" element={<JaarplanPage />} />
                  <Route path="/email-templates" element={<EmailTemplatesPage />} />
                </Route>
                <Route path="/enquete-extern/:id" element={<EnqueteExternPage />} />
                <Route path="/unsubscribe" element={<UnsubscribePage />} />
                <Route path="/checkout/return" element={<CheckoutReturn />} />
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
