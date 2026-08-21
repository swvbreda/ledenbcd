import { AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SourceLike {
  key: string;
  kind: string;
  date: string | null;
  invoice: string;
  shareAmount: number;
  direction: "in" | "out";
}

const fmtDate = (value: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value).slice(0, 10)
    : d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtAmount = (value: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);

/**
 * Waarschuwing bij een samengevoegde regel: bankafschrijving en factuurboeking
 * op hetzelfde factuurnummer, oftewel een mogelijke dubbele boeking.
 */
export default function MergedSourcesHint({ sources }: { sources: SourceLike[] }) {
  if (!sources || sources.length < 2) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="ml-1 inline-flex align-middle text-amber-600"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertCircle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="mb-1 text-xs font-medium">Mogelijke dubbele betaling</p>
        <p className="mb-1.5 text-[11px] text-muted-foreground">
          Bankafschrijving en factuurboeking met hetzelfde factuurnummer zijn samengevoegd tot één regel.
        </p>
        <ul className="space-y-0.5 text-[11px]">
          {sources.map((s) => (
            <li key={s.key} className="tabular-nums">
              {s.kind === "ponto" ? "Bank" : "Factuur"} · {fmtDate(s.date)} · {s.invoice || "geen nr"} ·{" "}
              {fmtAmount(s.direction === "in" ? s.shareAmount : -s.shareAmount)}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
