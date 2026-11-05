import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardLayout = lazy(() => import("@/components/DashboardLayout"));

export const Route = createFileRoute("/_dashboard")({
  component: () => (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground text-sm">Laden...</p></div>}>
        <DashboardLayout />
      </Suspense>
    </ProtectedRoute>
  ),
});
