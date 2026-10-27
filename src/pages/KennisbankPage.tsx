import { Navigate, useLocation } from "@/lib/router-compat";
import { Link } from "@tanstack/react-router";
import { Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { legacyDocumentTarget } from "@/lib/importantDocuments";

const KENNISBANK_URL = "https://coffeeshopbond.nl/kennisbank?embed=1";

export default function KennisbankPage() {
  const { hash } = useLocation();
  const target = legacyDocumentTarget(hash);
  if (target) return <Navigate to={target} replace />;

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden p-3 sm:p-6">
      <div className="min-w-0 max-w-full overflow-hidden rounded-xl border bg-card">
        <iframe src={KENNISBANK_URL} title="BCD Kennisbank" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="block h-[calc(100dvh-10rem)] min-h-[520px] w-full max-w-full border-0" />
      </div>
      <Button variant="outline" asChild><Link to="/belangrijke-documenten"><Files className="h-4 w-4" />Belangrijke documenten</Link></Button>
    </div>
  );
}
