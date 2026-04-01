import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getBenefitImageUrl, type Benefit } from "@/hooks/useBenefits";
import BenefitFormDialog from "@/components/BenefitFormDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Mail, Star, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useState } from "react";

export default function BenefitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  const { data: benefit, isLoading } = useQuery({
    queryKey: ["benefit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_benefits" as any)
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as Benefit;
    },
    enabled: !!id,
  });

  if (isLoading) return <LoadingSpinner />;
  if (!benefit) return <p className="p-8 text-center text-muted-foreground">Voordeel niet gevonden.</p>;

  const imageUrl = getBenefitImageUrl(benefit.image_path);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Back + Admin edit */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ledenvoordelen")} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Terug naar overzicht
        </Button>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1">
            <Pencil className="h-4 w-4" /> Bewerken
          </Button>
        )}
      </div>

      {/* Hero */}
      {imageUrl && (
        <div className="relative rounded-xl overflow-hidden h-56 md:h-72 bg-muted">
          <img src={imageUrl} alt={benefit.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-2xl md:text-3xl font-bold text-white">{benefit.title}</h1>
            {benefit.provider_name && (
              <p className="text-white/80 text-sm mt-1">{benefit.provider_name}</p>
            )}
          </div>
        </div>
      )}

      {!imageUrl && (
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{benefit.title}</h1>
          {benefit.provider_name && (
            <p className="text-muted-foreground mt-1">{benefit.provider_name}</p>
          )}
        </div>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{benefit.category}</Badge>
        {benefit.featured && (
          <Badge className="gap-1 bg-primary"><Star className="h-3 w-3" /> Uitgelicht</Badge>
        )}
        {benefit.discount_info && (
          <Badge variant="outline" className="border-primary/30 text-primary">
            {benefit.discount_info}
          </Badge>
        )}
        {!benefit.active && <Badge variant="destructive">Inactief</Badge>}
      </div>

      {/* Description */}
      {benefit.description && (
        <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
      )}

      {/* Rich detail content (markdown) */}
      {benefit.detail_content && (
        <article className="prose prose-sm md:prose-base max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary prose-strong:text-foreground">
          <ReactMarkdown>{benefit.detail_content}</ReactMarkdown>
        </article>
      )}

      {/* Contact links */}
      <div className="flex flex-wrap gap-3 pt-2">
        {benefit.provider_url && (
          <Button asChild variant="outline" size="sm">
            <a href={benefit.provider_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Website bezoeken
            </a>
          </Button>
        )}
        {benefit.contact_email && (
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:${benefit.contact_email}`}>
              <Mail className="h-4 w-4 mr-1" /> Contact opnemen
            </a>
          </Button>
        )}
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-border bg-muted/50 p-4 text-xs text-muted-foreground">
        <p>De vermelding van een aanbieder, product of dienst is uitsluitend bedoeld ter informatie. Het betekent niet dat de organisatie het aanbod heeft beoordeeld, goedgekeurd of aanbeveelt. Er wordt geen garantie gegeven op inhoud, kwaliteit of uitvoering. De organisatie is op geen enkele manier aansprakelijk voor gevolgen die voortvloeien uit contact met of gebruik van het aanbod.</p>
      </div>

      <BenefitFormDialog open={editOpen} onOpenChange={setEditOpen} benefit={benefit} />
    </div>
  );
}
