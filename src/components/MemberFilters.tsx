import { useMemo } from "react";
import { Filter, X } from "lucide-react";

interface MemberFiltersProps {
  cities: string[];
  stadsdelen: string[];
  selectedCity: string;
  selectedStadsdeel: string;
  selectedJaren: string;
  onCityChange: (v: string) => void;
  onStadsdeelChange: (v: string) => void;
  onJarenChange: (v: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

const jarenOptions = [
  { label: "Alle", value: "" },
  { label: "< 5 jaar", value: "0-5" },
  { label: "5–10 jaar", value: "5-10" },
  { label: "10–20 jaar", value: "10-20" },
  { label: "20–30 jaar", value: "20-30" },
  { label: "30+ jaar", value: "30-99" },
];

const MemberFilters = ({
  cities, stadsdelen,
  selectedCity, selectedStadsdeel, selectedJaren,
  onCityChange, onStadsdeelChange, onJarenChange,
  onClear, hasActiveFilters,
}: MemberFiltersProps) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Filter size={15} className="text-muted-foreground" />

      <select
        value={selectedCity}
        onChange={(e) => onCityChange(e.target.value)}
        className="px-3 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Alle steden</option>
        {cities.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        value={selectedStadsdeel}
        onChange={(e) => onStadsdeelChange(e.target.value)}
        className="px-3 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Alle stadsdelen</option>
        {stadsdelen.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <select
        value={selectedJaren}
        onChange={(e) => onJarenChange(e.target.value)}
        className="px-3 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {jarenOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={13} /> Wis filters
        </button>
      )}
    </div>
  );
};

export default MemberFilters;
