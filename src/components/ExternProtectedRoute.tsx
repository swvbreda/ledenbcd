import { Navigate } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";

const ExternProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, mfaStatus } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Laden...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/extern-login" replace />;
  }

  // MFA enforcement for extern users
  if (mfaStatus === "needs_setup") {
    return <Navigate to="/mfa-setup" replace />;
  }
  if (mfaStatus === "needs_verify") {
    return <Navigate to="/mfa-verify" replace />;
  }

  return <>{children}</>;
};

export default ExternProtectedRoute;
