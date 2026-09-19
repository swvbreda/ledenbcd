import { Navigate, useLocation } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { savePostLoginPath } from "@/lib/postLoginPath";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isExtern } = useAuth();
  const location = useLocation();

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

  return <>{children}</>;
};

export default ProtectedRoute;
