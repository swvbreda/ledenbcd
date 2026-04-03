import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Benefit } from "@/hooks/useBenefits";
import { getBenefitImageUrl } from "@/hooks/useBenefits";
import { Button } from "@/components/ui/button";

interface Props {
  benefit: Benefit;
  onEdit?: (b: Benefit) => void;
  isAdmin?: boolean;
}

export default function BenefitCard({ benefit, onEdit, isAdmin }: Props) {
  const navigate = useNavigate();
  const imageUrl = getBenefitImageUrl(benefit.image_path);

  const handleClick = () => {
    navigate(`/ledenvoordelen/${benefit.id}`);
  };

  return (
    <Card
      className={`overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 group cursor-pointer border-border/50 ${!benefit.active ? "opacity-50" : ""}`}
      onClick={handleClick}
    >
      {/* Product image */}
      <div className="relative aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={benefit.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <div className="text-5xl font-bold">{benefit.title.charAt(0)}</div>
          </div>
        )}
        {benefit.featured && (
          <Badge className="absolute top-2 left-2 gap-1 bg-primary shadow-md">
            <Star className="h-3 w-3" /> Uitgelicht
          </Badge>
        )}
        <Badge variant="secondary" className="absolute top-2 right-2 shadow-sm">{benefit.category}</Badge>
        {isAdmin && onEdit && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute bottom-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            onClick={(e) => { e.stopPropagation(); onEdit(benefit); }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Product info – provider → title → description → price */}
      <CardContent className="p-4 space-y-1.5">
        {benefit.provider_name && (
          <p className="text-xs text-muted-foreground">{benefit.provider_name}</p>
        )}
        <h3 className="font-bold text-base leading-snug line-clamp-2">{benefit.title}</h3>
        {benefit.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{benefit.description}</p>
        )}

        {/* Price display – bol.com style */}
        {benefit.price != null && (
          <div className="mt-3 space-y-1">
            <p className="text-2xl font-black text-primary leading-none">
              <span>€{Math.floor(benefit.price).toLocaleString("nl-NL")}</span>
              <span className="text-base align-super">{String(Math.round((benefit.price % 1) * 100)).padStart(2, '0')}</span>
            </p>
            {benefit.original_price != null && benefit.original_price > benefit.price && (
              <>
                <p className="text-xs text-muted-foreground">
                  Meestal <span className="line-through">€{benefit.original_price.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </p>
                <p className="text-xs font-bold text-primary">
                  Je bespaart {Math.round((1 - benefit.price / benefit.original_price) * 100)}%
                </p>
              </>
            )}
          </div>
        )}

        {/* Fallback: text-based discount info when no numeric price */}
        {benefit.price == null && benefit.discount_info && (
          <p className="mt-2 text-sm font-semibold text-primary leading-snug line-clamp-2">{benefit.discount_info}</p>
        )}
      </CardContent>
    </Card>
  );
}
