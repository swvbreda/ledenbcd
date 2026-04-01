import { useState, useMemo } from "react";
import { useBenefits, type Benefit } from "@/hooks/useBenefits";
import { useAuth } from "@/hooks/useAuth";
import BenefitCard from "@/components/BenefitCard";
import BenefitFormDialog from "@/components/BenefitFormDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import LoadingSpinner from "@/components/LoadingSpinner";

const DISCLAIMER = "De vermelding van een aanbieder, product of dienst is uitsluitend bedoeld ter informatie. Het betekent niet dat de organisatie het aanbod heeft beoordeeld, goedgekeurd of aanbeveelt. Er wordt geen garantie gegeven op inhoud, kwaliteit of uitvoering. De organisatie is op geen enkele manier aansprakelijk voor gevolgen die voortvloeien uit contact met of gebruik van het aanbod.";

export default function LedenvoordelenPage() {
  const { data: benefits, isLoading } = useBenefits();
  const { isAdmin } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBenefit, setEditBenefit] = useState<Benefit | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const categories = useMemo(() => {
    if (!benefits) return [];
    const cats = [...new Set(benefits.filter((b) => b.active || isAdmin).map((b) => b.category))];
    return cats.sort();
  }, [benefits, isAdmin]);

  const filtered = useMemo(() => {
    if (!benefits) return [];
    let list = isAdmin ? benefits : benefits.filter((b) => b.active);
    if (activeCategory) list = list.filter((b) => b.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) =>
        b.title.toLowerCase().includes(q) ||
        (b.provider_name && b.provider_name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [benefits, activeCategory, isAdmin, search]);

  const handleEdit = (b: Benefit) => {
    setEditBenefit(b);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditBenefit(null);
    setDialogOpen(true);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ledenvoordelen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Relevante producten, diensten en kortingen voor coffeeshopondernemers
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleNew} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Toevoegen
          </Button>
        )}
      </div>

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={activeCategory === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setActiveCategory(null)}
          >
            Alles
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>
      )}

      {/* Benefits grid */}
      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          {activeCategory ? "Geen voordelen in deze categorie." : "Er zijn nog geen ledenvoordelen geplaatst."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <BenefitCard key={b.id} benefit={b} isAdmin={isAdmin} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-lg border border-border bg-muted/50 p-4 flex gap-3 text-xs text-muted-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>{DISCLAIMER}</p>
      </div>

      <BenefitFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        benefit={editBenefit}
      />
    </div>
  );
}
