import { Checkbox } from "@/components/ui/checkbox";
import { buildTree, type RegisterDossier } from "@/lib/dossierRegister";

/** Meerkeuze voor bijbehorende dossiers (hoofddossier met subdossiers). */
export function DossierPicker({ dossiers, value, onChange, idPrefix = "dp" }: {
  dossiers: RegisterDossier[]; value: string[]; onChange: (next: string[]) => void; idPrefix?: string;
}) {
  const tree = buildTree(dossiers);
  const toggle = (id: string, on: boolean) => onChange(on ? [...new Set([...value, id])] : value.filter((x) => x !== id));
  if (!tree.length) return <p className="text-xs text-muted-foreground">Geen dossiers beschikbaar.</p>;
  const Row = ({ d, sub }: { d: RegisterDossier; sub?: boolean }) => (
    <label htmlFor={`${idPrefix}-${d.id}`} className={`flex items-center gap-2 text-sm py-0.5 ${sub ? "pl-6" : ""}`}>
      <Checkbox id={`${idPrefix}-${d.id}`} checked={value.includes(d.id)} onCheckedChange={(v) => toggle(d.id, v === true)} />
      <span className={`break-words ${sub ? "" : "font-medium"}`}>{d.name}</span>
    </label>
  );
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border border-border p-2">
      {tree.map((d) => (
        <div key={d.id}>
          <Row d={d} />
          {d.children.map((c) => <Row key={c.id} d={c} sub />)}
        </div>
      ))}
    </div>
  );
}
