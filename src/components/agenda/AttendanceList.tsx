import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AttendanceEntry {
  name: string;
  detail?: string | null;
}

interface Props {
  label: string;
  entries: AttendanceEntry[];
  /** Hoeveel namen in de compacte regel getoond worden */
  preview?: number;
}

export default function AttendanceList({ label, entries, preview = 3 }: Props) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  const shown = entries.slice(0, preview);
  const rest = entries.length - shown.length;

  return (
    <div className="mt-2 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-full items-center gap-1.5 text-left text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={open}
      >
        <span className="font-medium text-foreground">
          {label} · {entries.length}
        </span>
        <span className="truncate">
          {shown.map((e) => e.name).join(", ")}
          {rest > 0 ? ` +${rest} meer` : ""}
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e, i) => (
            <li key={`${e.name}-${i}`} className="min-w-0">
              <span className="block truncate font-medium text-foreground">{e.name}</span>
              {e.detail && (
                <span className="block truncate text-xs text-muted-foreground">{e.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
