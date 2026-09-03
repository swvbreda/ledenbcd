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
      className={`overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 group cursor-pointer border-2 border-primary/60 hover:border-primary bg-white flex flex-col ${!benefit.active ? "opacity-50" : ""}`}
      onClick={handleClick}
    >
      {/* Product image */}
      <div className="relative aspect-[4/3] bg-white flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={benefit.title}
            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
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
        <Badge variant="secondary" className="absolute top-2 right-2 shadow-xs">{benefit.category}</Badge>
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

      {/* Product info – flex layout to align rows across cards */}
      <CardContent className="p-4 flex flex-col flex-1">
        {/* Provider name – fixed height row */}
        <p className="text-xs text-muted-foreground min-h-[1rem]">
          {benefit.provider_name || "\u00A0"}
        </p>

        {/* Title – fixed 2-line height */}
        <h3 className="font-bold text-base leading-snug line-clamp-2 min-h-[2.5rem] mt-1">
          {benefit.title}
        </h3>

        {/* Description – fixed 2-line height */}
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem] mt-1">
          {benefit.description || "\u00A0"}
        </p>

        {/* Spacer pushes price to bottom */}
        <div className="flex-1" />

        {/* Price display */}
        {benefit.price != null && (
          <div className="mt-3 space-y-1">
            <div className="inline-block rounded-sm bg-primary px-2.5 py-1">
              <span className="text-lg font-black text-primary-foreground leading-none">
                €{benefit.price.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {benefit.original_price != null && benefit.original_price > benefit.price && (
              <>
                <p className="text-xs text-muted-foreground">
                  Regulier <span className="line-through">€{benefit.original_price.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </p>
                <p className="text-xs font-bold text-foreground">
                  Je bespaart {Math.round((1 - benefit.price / benefit.original_price) * 100)}%
                </p>
              </>
            )}
          </div>
        )}

        {/* Fallback: text-based discount info when no numeric price */}
        {benefit.price == null && benefit.discount_info && (
          <p className="mt-3 text-sm font-semibold text-primary leading-snug line-clamp-2">{benefit.discount_info}</p>
        )}
      </CardContent>
    </Card>
  );
}
