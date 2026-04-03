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
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Mail, Pencil, ShoppingCart, CheckCircle2, Info, Building2 } from "lucide-react";
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

  // Fetch supplier org info if linked
  const { data: supplierOrg } = useQuery({
    queryKey: ["supplier-org", benefit?.supplier_org_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_organizations")
        .select("id, name, description, city, website, logo_path")
        .eq("id", benefit!.supplier_org_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!benefit?.supplier_org_id,
  });

  // Fetch other products from same provider
  const { data: otherProducts = [] } = useQuery({
    queryKey: ["other-products", benefit?.provider_name, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_benefits" as any)
        .select("id, title, image_path, price, original_price, category, provider_name, active")
        .eq("active", true)
        .neq("id", id!);
      if (error) throw error;
      // Filter by same provider name client-side
      return (data as unknown as Benefit[]).filter(
        (b) => b.provider_name === benefit!.provider_name
      );
    },
    enabled: !!benefit?.provider_name && !!id,
  });

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
          <article className="benefit-detail-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{benefit.detail_content}</ReactMarkdown>
          </article>
        </div>
      )}

      {/* Supplier info block */}
      {(supplierOrg || benefit.provider_name) && (
        <div className="mt-10 rounded-lg border-2 border-primary/60 bg-white p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                {supplierOrg?.name || benefit.provider_name}
              </h3>
              {supplierOrg?.city && (
                <p className="text-xs text-muted-foreground">{supplierOrg.city}</p>
              )}
            </div>
          </div>
          {supplierOrg?.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{supplierOrg.description}</p>
          )}
          {supplierOrg?.website && (
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
              <a href={supplierOrg.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" /> Website bezoeken
              </a>
            </Button>
          )}
        </div>
      )}

      {/* Other products from same provider */}
      {otherProducts.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-bold font-display">
            Meer van {benefit.provider_name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherProducts.slice(0, 3).map((p) => {
              const imgUrl = getBenefitImageUrl(p.image_path);
              return (
                <Card
                  key={p.id}
                  className="overflow-hidden border-2 border-primary/60 hover:border-primary bg-white cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                  onClick={() => navigate(`/ledenvoordelen/${p.id}`)}
                >
                  <div className="aspect-[4/3] bg-white flex items-center justify-center overflow-hidden">
                    {imgUrl ? (
                      <img src={imgUrl} alt={p.title} className="w-full h-full object-contain p-3" loading="lazy" />
                    ) : (
                      <div className="text-4xl font-bold text-muted-foreground/20">{p.title.charAt(0)}</div>
                    )}
                  </div>
                  <CardContent className="p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">{p.provider_name}</p>
                    <h4 className="font-semibold text-sm line-clamp-2">{p.title}</h4>
                    {p.price != null && (
                      <div className="inline-block rounded bg-primary px-2 py-0.5">
                        <span className="text-sm font-bold text-primary-foreground">
                          €{p.price.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-10 rounded-lg border-2 border-primary/60 bg-white p-4 flex gap-3">
        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          De vermelding van een aanbieder, product of dienst is uitsluitend bedoeld ter informatie. Het betekent niet dat de organisatie het aanbod heeft beoordeeld, goedgekeurd of aanbeveelt. Er wordt geen garantie gegeven op inhoud, kwaliteit of uitvoering. De organisatie is op geen enkele manier aansprakelijk voor gevolgen die voortvloeien uit contact met of gebruik van het aanbod.
        </p>
      </div>

      <BenefitFormDialog open={editOpen} onOpenChange={setEditOpen} benefit={benefit} />
    </div>
  );
}
