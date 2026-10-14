import { cn } from "@/lib/utils";
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/internalWork";

/** Rustige underline-tabs, alleen voor Projecten & taken (overschrijft de grijze pil-stijl lokaal). */
export const tabsListCls =
  "h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0 overflow-x-auto overflow-y-hidden";
export const tabsTriggerCls =
  "relative min-h-11 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none -mb-px";

/** Surface-kaart: wit, hairline border, zachte schaduw. */
export const surfaceCls = "rounded-xl border border-border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.05)]";

/** Kleine sectiekop (sans, sentence case) — globale h-styling wordt lokaal overschreven. */
export const sectionHeadCls = "!font-sans text-[13px] font-semibold text-muted-foreground tracking-normal";

const STATUS_CLS: Record<ProjectStatus | "archived", string> = {
  te_bevestigen: "bg-muted text-foreground/80 border-warning/40 border-dashed",
  actief: "bg-brand-navy/10 text-brand-navy border-brand-navy/15",
  gepauzeerd: "bg-warning/15 text-warning-foreground border-warning/30",
  afgerond: "bg-success/12 text-success-strong border-success/25",
  archived: "bg-muted text-muted-foreground border-border",
};

export function ProjectStatusBadge({ status, archived, className }: { status: ProjectStatus; archived?: boolean; className?: string }) {
  const key = archived ? "archived" : status;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_CLS[key], className)}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {archived ? "Gearchiveerd" : PROJECT_STATUS_LABEL[status]}
    </span>
  );
}

export function CountChip({ n, singular, plural }: { n: number; singular: string; plural: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
      {n} {n === 1 ? singular : plural}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={cn("min-h-9 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
