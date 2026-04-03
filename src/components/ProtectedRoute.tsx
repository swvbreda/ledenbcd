import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isExtern, mfaStatus } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Laden...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isExtern) {
    return <Navigate to="/extern" replace />;
  }

  // MFA enforcement
  if (mfaStatus === "needs_setup") {
    return <Navigate to="/mfa-setup" replace />;
  }
  if (mfaStatus === "needs_verify") {
    return <Navigate to="/mfa-verify" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
