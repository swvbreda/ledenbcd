import { Navigate, useLocation } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import AuthUnavailable from "@/components/AuthUnavailable";
import { savePostLoginPath } from "@/lib/postLoginPath";
import { memberPasswordlessEnabled } from "@/lib/memberAccessFlag";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { authError, retryAuth, user, loading, isExtern, isAdmin, linkedMemberId } = useAuth();
  const location = useLocation();

  if (authError) return <AuthUnavailable message={authError} onRetry={retryAuth} />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Laden...</p>
      </div>
    );
  }

  const remember = () => savePostLoginPath(location.pathname + location.search);

  if (!user) {
    remember();
    return <Navigate to="/login" replace />;
  }

  if (isExtern) {
    return <Navigate to="/extern" replace />;
  }

  if (memberPasswordlessEnabled && !isAdmin && !linkedMemberId) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
