import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Mail, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Benefit } from "@/hooks/useBenefits";
import { getBenefitImageUrl } from "@/hooks/useBenefits";

interface Props {
  benefit: Benefit;
  onEdit?: (b: Benefit) => void;
  isAdmin?: boolean;
}

export default function BenefitCard({ benefit, onEdit, isAdmin }: Props) {
  const navigate = useNavigate();
  const imageUrl = getBenefitImageUrl(benefit.image_path);

  const handleClick = () => {
    if (isAdmin && onEdit) {
      onEdit(benefit);
    } else {
      navigate(`/ledenvoordelen/${benefit.id}`);
    }
  };

  return (
    <Card
      className={`overflow-hidden transition-shadow hover:shadow-lg group cursor-pointer ${!benefit.active ? "opacity-50" : ""}`}
      onClick={handleClick}
    >
      <div className="relative h-40 bg-muted flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={benefit.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="text-4xl text-muted-foreground/30 font-bold">{benefit.title.charAt(0)}</div>
        )}
        {benefit.featured && (
          <Badge className="absolute top-2 left-2 gap-1 bg-primary">
            <Star className="h-3 w-3" /> Uitgelicht
          </Badge>
        )}
        <Badge variant="secondary" className="absolute top-2 right-2">{benefit.category}</Badge>
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-base leading-tight">{benefit.title}</h3>
        {benefit.provider_name && (
          <p className="text-xs text-muted-foreground">{benefit.provider_name}</p>
        )}
        {benefit.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{benefit.description}</p>
        )}
        {benefit.discount_info && (
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            {benefit.discount_info}
          </Badge>
        )}
        <div className="flex gap-2 pt-1">
          {benefit.provider_url && (
            <a
              href={benefit.provider_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" /> Website
            </a>
          )}
          {benefit.contact_email && (
            <a
              href={`mailto:${benefit.contact_email}`}
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="h-3 w-3" /> Contact
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}