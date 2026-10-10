import { Navigate } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import AuthUnavailable from "@/components/AuthUnavailable";

const ExternProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { authError, retryAuth, user, loading } = useAuth();

  if (authError) return <AuthUnavailable message={authError} onRetry={retryAuth} />;

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

  return <>{children}</>;
};

export default ExternProtectedRoute;
