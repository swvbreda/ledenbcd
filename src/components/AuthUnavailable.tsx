import { Button } from "@/components/ui/button";

const AuthUnavailable = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-background p-6">
    <div role="alert" className="max-w-md w-full space-y-4 rounded-lg border border-destructive/40 p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">Ledenportaal tijdelijk niet bereikbaar</h1>
      <p className="text-sm text-muted-foreground">
        Je inlog en rechten konden niet worden gecontroleerd. Er wordt niets getoond tot dit gelukt is.
      </p>
      <p className="text-xs text-destructive break-words">{message}</p>
      <Button onClick={onRetry}>Opnieuw proberen</Button>
    </div>
  </div>
);

export default AuthUnavailable;
