import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getBenefitImageUrl, type Benefit } from "@/hooks/useBenefits";
import { useBenefitImages } from "@/hooks/useBenefitImages";
import BenefitFormDialog from "@/components/BenefitFormDialog";
import BenefitGallery from "@/components/BenefitGallery";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Mail, Star, Pencil, ShoppingCart, CheckCircle2, Info } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

  const { data: galleryImages = [] } = useBenefitImages(id);

  if (isLoading) return <LoadingSpinner />;
  if (!benefit) return <p className="p-8 text-center text-muted-foreground">Voordeel niet gevonden.</p>;

  const hasPrice = benefit.price != null;
  const hasOriginalPrice = benefit.original_price != null;
  const savingsPercent = hasPrice && hasOriginalPrice && benefit.original_price! > 0
    ? Math.round(((benefit.original_price! - benefit.price!) / benefit.original_price!) * 100)
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 pb-12">
      {/* Top bar */}
      <div className="flex items-center justify-between py-4 border-b border-border mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ledenvoordelen")} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Terug naar overzicht
        </Button>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="h-4 w-4" /> Bewerken
          </Button>
        )}
      </div>

      {/* Product header — image left, info right */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr] lg:grid-cols-[480px,1fr] gap-8 lg:gap-12">
        {/* Gallery */}
        <div className="md:sticky md:top-4 md:self-start">
          <BenefitGallery
            mainImagePath={benefit.image_path}
            galleryImages={galleryImages}
            alt={benefit.title}
          />
        </div>

        {/* Product info column */}
        <div className="space-y-5">
          {/* Category badge */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs font-medium">{benefit.category}</Badge>
            {benefit.featured && (
              <Badge className="gap-1 bg-primary text-primary-foreground text-xs">
                <Star className="h-3 w-3" /> Uitgelicht
              </Badge>
            )}
            {!benefit.active && <Badge variant="destructive" className="text-xs">Inactief</Badge>}
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight tracking-tight">
            {benefit.title}
          </h1>

          {/* Provider */}
          {benefit.provider_name && (
            <p className="text-sm text-muted-foreground">
              Aanbieder: <span className="font-semibold text-foreground">{benefit.provider_name}</span>
            </p>
          )}

          {/* Price block */}
          {(hasPrice || benefit.discount_info) && (
            <div className="rounded-xl border-2 border-primary/15 bg-primary/[0.03] p-5 space-y-3">
              {hasPrice && (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-primary">
                      €{benefit.price!.toLocaleString("nl-NL")}
                    </span>
                    {hasOriginalPrice && (
                      <span className="text-base text-muted-foreground line-through">
                        €{benefit.original_price!.toLocaleString("nl-NL")}
                      </span>
                    )}
                  </div>
                  {savingsPercent != null && savingsPercent > 0 && (
                    <p className="text-sm font-semibold text-foreground">
                      Je bespaart {savingsPercent}%
                    </p>
                  )}
                </div>
              )}
              {benefit.discount_info && (
                <div className="flex items-start gap-2 text-sm">
                  <ShoppingCart className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="font-medium text-primary">{benefit.discount_info}</span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {benefit.description && (
            <p className="text-[15px] text-muted-foreground leading-relaxed">
              {benefit.description}
            </p>
          )}

          {/* CTA buttons */}
          <div className="space-y-3 pt-1">
            {benefit.provider_url && (
              <Button asChild className="w-full gap-2 h-12 text-base font-semibold" size="lg">
                <a href={benefit.provider_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Bekijk bij aanbieder
                </a>
              </Button>
            )}
            {benefit.contact_email && (
              <Button asChild variant="outline" className="w-full gap-2 h-12 text-base" size="lg">
                <a href={`mailto:${benefit.contact_email}`}>
                  <Mail className="h-4 w-4" /> Contact opnemen
                </a>
              </Button>
            )}
            {!benefit.provider_url && !benefit.contact_email && (
              <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm text-muted-foreground text-center">
                Neem contact op met het secretariaat voor meer informatie.
              </div>
            )}
          </div>

          {/* Trust signals */}
          <div className="pt-2 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>Exclusief voor BCD-leden</span>
            </div>
            {benefit.provider_name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span>Aangeboden door {benefit.provider_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Separator */}
      {benefit.detail_content && (
        <div className="border-t border-border mt-10 mb-8" />
      )}

      {/* Rich detail content (markdown) */}
      {benefit.detail_content && (
        <div className="max-w-4xl">
          <article className="prose prose-base md:prose-lg max-w-none dark:prose-invert
            prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tight
            prose-h2:text-xl prose-h2:md:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
            prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-muted-foreground prose-p:leading-7 prose-p:mb-4
            prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground prose-strong:font-semibold
            prose-li:text-muted-foreground prose-li:my-1
            prose-ul:my-4 prose-ol:my-4
            prose-hr:my-8 prose-hr:border-border
            prose-table:border prose-table:border-border prose-table:rounded-lg prose-table:overflow-hidden
            prose-th:bg-muted prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold prose-th:text-foreground prose-th:text-sm
            prose-td:px-4 prose-td:py-3 prose-td:border-t prose-td:border-border prose-td:text-sm
            prose-tr:border-border
            prose-img:rounded-lg prose-img:border prose-img:border-border"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{benefit.detail_content}</ReactMarkdown>
          </article>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-10 rounded-lg border border-border bg-muted/30 p-5 flex gap-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          De vermelding van een aanbieder, product of dienst is uitsluitend bedoeld ter informatie. Het betekent niet dat de organisatie het aanbod heeft beoordeeld, goedgekeurd of aanbeveelt. Er wordt geen garantie gegeven op inhoud, kwaliteit of uitvoering. De organisatie is op geen enkele manier aansprakelijk voor gevolgen die voortvloeien uit contact met of gebruik van het aanbod.
        </p>
      </div>

      <BenefitFormDialog open={editOpen} onOpenChange={setEditOpen} benefit={benefit} />
    </div>
  );
}
