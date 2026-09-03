import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { AlertCircle, X, FileWarning, UserX } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useMergedMember } from "@/hooks/useMemberEdits";
import { useMemberContributions } from "@/hooks/useContributions";
import { Button } from "@/components/ui/button";
import type { Member } from "@/data/types";

/** Fields we consider required for a complete member profile */
const REQUIRED_FIELDS: { key: keyof Member; label: string }[] = [
  { key: "email", label: "E-mail" },
  { key: "telefoon", label: "Telefoon" },
  { key: "contactpersoon", label: "Contactpersoon" },
  { key: "factuurEmail", label: "Factuur e-mail" },
  { key: "factuurAdres", label: "Factuuradres" },
  { key: "factuurPostcode", label: "Factuur postcode" },
  { key: "factuurPlaats", label: "Factuur plaats" },
  { key: "factuurBedrijfsnaam", label: "Factuur bedrijfsnaam" },
];

function getMissingFields(member: Member): string[] {
  return REQUIRED_FIELDS.filter(({ key }) => {
    const val = member[key];
    return !val || (typeof val === "string" && val.trim() === "");
  }).map(({ label }) => label);
}

interface AlertForMemberProps {
  memberId: number;
}

function AlertForMember({ memberId }: AlertForMemberProps) {
  const navigate = useNavigate();
  const { member } = useMergedMember(memberId);
  const { data: contributions } = useMemberContributions(memberId);
  const [dismissed, setDismissed] = useState(() => {
    try {
      const key = `bcd-alert-dismissed-${memberId}`;
      const stored = sessionStorage.getItem(key);
      return stored === "true";
    } catch {
      return false;
    }
  });

  const missingFields = useMemo(() => (member ? getMissingFields(member) : []), [member]);
  const unpaidContributions = useMemo(
    () => (contributions ?? []).filter((c) => !c.paid),
    [contributions]
  );

  if (dismissed || (!missingFields.length && !unpaidContributions.length)) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(`bcd-alert-dismissed-${memberId}`, "true");
    } catch {}
  };

  return (
    <div className="relative rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-sm hover:bg-amber-500/20 transition-colors text-amber-700 dark:text-amber-400"
      >
        <X size={16} />
      </button>

      {missingFields.length > 0 && (
        <div className="flex items-start gap-3">
          <UserX size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Profielgegevens onvolledig
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
              De volgende gegevens ontbreken: {missingFields.join(", ")}
            </p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 mt-1 text-xs text-amber-700 dark:text-amber-400 underline"
              onClick={() => navigate(`/leden/${memberId}`)}
            >
              Profiel aanvullen →
            </Button>
          </div>
        </div>
      )}

      {unpaidContributions.length > 0 && (
        <div className="flex items-start gap-3">
          <FileWarning size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Openstaande contributie{unpaidContributions.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
              {unpaidContributions.map((c) => c.year).join(", ")} — nog niet betaald
            </p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 mt-1 text-xs text-amber-700 dark:text-amber-400 underline"
              onClick={() => navigate(`/leden/${memberId}`)}
            >
              Bekijk contributie →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Renders alert banners for each linked member of the current user.
 * Only shows for non-admin users with linked member profiles.
 */
const MemberAlertBanner = () => {
  const { isAdmin, linkedMemberIds } = useAuth();

  // Don't show for admins or users without linked members
  if (isAdmin || linkedMemberIds.length === 0) return null;

  return (
    <>
      {linkedMemberIds.map((id) => (
        <AlertForMember key={id} memberId={id} />
      ))}
    </>
  );
};

export default MemberAlertBanner;
