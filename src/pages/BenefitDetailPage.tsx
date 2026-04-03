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
import { ArrowLeft, ExternalLink, Mail, Pencil, ShoppingCart, CheckCircle2, Info } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";

function PriceBlock({ benefit }: { benefit: Benefit }) {
  const hasPrice = benefit.price != null;
  const hasOriginalPrice = benefit.original_price != null;
  const savingsPercent = hasPrice && hasOriginalPrice && benefit.original_price! > 0
    ? Math.round(((benefit.original_price! - benefit.price!) / benefit.original_price!) * 100)
    : null;

  if (!hasPrice && !benefit.discount_info) return null;

  return (
    <div className="space-y-2">
      {hasPrice && (
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[2rem] font-bold leading-none" style={{ color: 'hsl(var(--primary))' }}>
            €{benefit.price!.toLocaleString("nl-NL")}
          </span>
          {hasOriginalPrice && (
            <span className="text-sm text-muted-foreground line-through">
              €{benefit.original_price!.toLocaleString("nl-NL")}
            </span>
          )}
          {savingsPercent != null && savingsPercent > 0 && (
            <Badge variant="secondary" className="text-xs font-semibold bg-success/10 text-success border-success/20">
              -{savingsPercent}%
            </Badge>
          )}
        </div>
      )}
      {benefit.discount_info && (
        <div className="flex items-center gap-2 text-sm">
          <ShoppingCart className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />
          <span className="font-medium" style={{ color: 'hsl(var(--primary))' }}>{benefit.discount_info}</span>
        </div>
      )}
    </div>
  );
}

function ActionButtons({ benefit }: { benefit: Benefit }) {
  return (
    <div className="space-y-2.5">
      {benefit.provider_url && (
        <Button asChild className="w-full gap-2 h-11 text-sm font-semibold">
          <a href={benefit.provider_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" /> Bekijk bij aanbieder
          </a>
        </Button>
      )}
      {benefit.contact_email && (
        <Button asChild variant="outline" className="w-full gap-2 h-11 text-sm">
          <a href={`mailto:${benefit.contact_email}`}>
            <Mail className="h-4 w-4" /> Contact opnemen
          </a>
        </Button>
      )}
      {!benefit.provider_url && !benefit.contact_email && (
        <div className="rounded-lg bg-muted/50 border border-border p-3.5 text-sm text-muted-foreground text-center">
          Neem contact op met het secretariaat voor meer informatie.
        </div>
      )}
    </div>
  );
}

function TrustSignals({ providerName }: { providerName?: string | null }) {
  return (
    <div className="border-t border-border pt-4 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />
        <span>Exclusief voor BCD-leden</span>
      </div>
      {providerName && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />
          <span>Aangeboden door {providerName}</span>
        </div>
      )}
    </div>
  );
}

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

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 pb-12">
      {/* Top bar */}
      <div className="flex items-center justify-between py-3 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ledenvoordelen")} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar overzicht
        </Button>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5 text-xs">
            <Pencil className="h-3.5 w-3.5" /> Bewerken
          </Button>
        )}
      </div>

      {/* Product header — image left, info right */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr] lg:grid-cols-[440px,1fr] gap-6 lg:gap-10">
        {/* Gallery */}
        <div className="md:sticky md:top-4 md:self-start">
          <BenefitGallery
            mainImagePath={benefit.image_path}
            galleryImages={galleryImages}
            alt={benefit.title}
          />
        </div>

        {/* Product info column */}
        <div className="space-y-4">
          {/* Category */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs font-medium">{benefit.category}</Badge>
            {!benefit.active && <Badge variant="destructive" className="text-xs">Inactief</Badge>}
          </div>

          {/* Title */}
          <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight tracking-tight">
            {benefit.title}
          </h1>

          {/* Provider */}
          {benefit.provider_name && (
            <p className="text-xs text-muted-foreground">
              Aanbieder: <span className="font-semibold text-foreground">{benefit.provider_name}</span>
            </p>
          )}

          {/* Separator */}
          <div className="border-t border-border" />

          {/* Price */}
          <PriceBlock benefit={benefit} />

          {/* Short description */}
          {benefit.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {benefit.description}
            </p>
          )}

          {/* Separator */}
          <div className="border-t border-border" />

          {/* CTA */}
          <ActionButtons benefit={benefit} />

          {/* Trust signals */}
          <TrustSignals providerName={benefit.provider_name} />
        </div>
      </div>

      {/* Rich detail content (markdown) */}
      {benefit.detail_content && (
        <div className="mt-10 max-w-4xl">
          <div className="border-t border-border mb-8" />
          <article className="prose prose-sm md:prose-base max-w-none dark:prose-invert
            prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tight
            prose-h2:text-lg prose-h2:md:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
            prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
            prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-3 prose-p:text-sm
            prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground prose-strong:font-semibold
            prose-li:text-muted-foreground prose-li:text-sm prose-li:my-0.5
            prose-ul:my-3 prose-ol:my-3
            prose-hr:my-6 prose-hr:border-border
            prose-table:text-sm prose-table:border prose-table:border-border prose-table:rounded-lg prose-table:overflow-hidden
            prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-foreground prose-th:text-xs
            prose-td:px-3 prose-td:py-2 prose-td:border-t prose-td:border-border prose-td:text-xs
            prose-tr:border-border
            prose-img:rounded-lg prose-img:border prose-img:border-border"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{benefit.detail_content}</ReactMarkdown>
          </article>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-10 rounded-lg border border-border bg-muted/30 p-4 flex gap-3">
        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          De vermelding van een aanbieder, product of dienst is uitsluitend bedoeld ter informatie. Het betekent niet dat de organisatie het aanbod heeft beoordeeld, goedgekeurd of aanbeveelt. Er wordt geen garantie gegeven op inhoud, kwaliteit of uitvoering. De organisatie is op geen enkele manier aansprakelijk voor gevolgen die voortvloeien uit contact met of gebruik van het aanbod.
        </p>
      </div>

      <BenefitFormDialog open={editOpen} onOpenChange={setEditOpen} benefit={benefit} />
    </div>
  );
}
