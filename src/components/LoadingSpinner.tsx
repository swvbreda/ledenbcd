import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner = ({ message = "Data laden..." }: LoadingSpinnerProps) => (
  <div className="flex flex-col items-center justify-center py-24 gap-3">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

export default LoadingSpinner;
