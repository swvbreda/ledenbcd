import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { displayName, initialsFor, type StaffMember } from "@/lib/projectWorkspace";

/** Initialen van echte accounts; volledige naam in tooltip. */
export function StaffAvatars({ ids, staff, max = 4 }: { ids: string[]; staff: StaffMember[]; max?: number }) {
  if (!ids.length) return null;
  const shown = ids.slice(0, max);
  const rest = ids.length - shown.length;
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex -space-x-2 shrink-0" aria-label="Medewerkers">
        {shown.map((id) => {
          const s = staff.find((x) => x.user_id === id);
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <span tabIndex={0} aria-label={displayName(s)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground text-xs font-semibold">
                  {initialsFor(s)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{displayName(s)}</TooltipContent>
            </Tooltip>
          );
        })}
        {rest > 0 && <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-xs">+{rest}</span>}
      </div>
    </TooltipProvider>
  );
}
