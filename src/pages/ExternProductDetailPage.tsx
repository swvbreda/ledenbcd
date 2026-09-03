import { useParams, useNavigate } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getBenefitImageUrl, type Benefit } from "@/hooks/useBenefits";
import { useBenefitImages } from "@/hooks/useBenefitImages";
import BenefitFormDialog from "@/components/BenefitFormDialog";
import BenefitGallery from "@/components/BenefitGallery";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Mail, Star, Pencil, ShoppingCart } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import bcdLogo from "@/assets/bcd-logo.png";

export default function ExternProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 flex items-center border-b border-border bg-card px-6 h-14">
          <img src={bcdLogo} alt="BCD" className="h-8 w-auto" />
        </header>
        <LoadingSpinner />
      </div>
    );
  }

  if (!benefit) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 flex items-center border-b border-border bg-card px-6 h-14">
          <img src={bcdLogo} alt="BCD" className="h-8 w-auto" />
        </header>
        <p className="p-8 text-center text-muted-foreground">Product niet gevonden.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-6 h-14">
        <div className="flex items-center gap-3">
          <img src={bcdLogo} alt="BCD" className="h-8 w-auto" />
          <h1 className="text-sm font-semibold font-display text-foreground">Productdetails</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-8">
        {/* Back + Edit */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/extern")} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Terug naar portaal
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1">
            <Pencil className="h-4 w-4" /> Bewerken
          </Button>
        </div>

        {/* Product header — same layout as member view */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <BenefitGallery
            mainImagePath={benefit.image_path}
            galleryImages={galleryImages}
            alt={benefit.title}
          />

          <div className="flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{benefit.category}</Badge>
                {benefit.featured && (
                  <Badge className="gap-1 bg-primary"><Star className="h-3 w-3" /> Uitgelicht</Badge>
                )}
                {!benefit.active && <Badge variant="destructive">Inactief</Badge>}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{benefit.title}</h1>

              {benefit.provider_name && (
                <p className="text-sm text-muted-foreground">
                  Aanbieder: <span className="font-medium text-foreground">{benefit.provider_name}</span>
                </p>
              )}

              {benefit.discount_info && (
                <div className="inline-flex items-center gap-2 rounded-lg border-2 border-primary/20 bg-primary/5 px-4 py-2">
                  <ShoppingCart className="h-4 w-4 text-brand-red" />
                  <span className="font-semibold text-primary">{benefit.discount_info}</span>
                </div>
              )}

              {benefit.description && (
                <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
              )}
            </div>

            <Card className="border-border">
              <CardContent className="p-4 space-y-3">
                {benefit.provider_url && (
                  <Button asChild className="w-full gap-2" size="lg">
                    <a href={benefit.provider_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Bekijk bij aanbieder
                    </a>
                  </Button>
                )}
                {benefit.contact_email && (
                  <Button asChild variant="outline" className="w-full gap-2" size="lg">
                    <a href={`mailto:${benefit.contact_email}`}>
                      <Mail className="h-4 w-4" /> Contact opnemen
                    </a>
                  </Button>
                )}
                {!benefit.provider_url && !benefit.contact_email && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Neem contact op met het secretariaat voor meer informatie.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rich detail content */}
        {benefit.detail_content && (
          <article className="prose prose-base md:prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-headings:mt-8 prose-headings:mb-4 prose-p:text-muted-foreground prose-p:leading-7 prose-p:mb-4 prose-a:text-primary prose-strong:text-foreground prose-li:text-muted-foreground prose-li:my-1.5 prose-ul:my-4 prose-hr:my-8 prose-hr:border-border prose-table:border prose-table:border-border prose-table:rounded-lg prose-table:overflow-hidden prose-th:bg-muted prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold prose-th:text-foreground prose-td:px-4 prose-td:py-3 prose-td:border-t prose-td:border-border prose-tr:border-border">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{benefit.detail_content}</ReactMarkdown>
          </article>
        )}

        {/* Disclaimer */}
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-xs text-muted-foreground">
          <p>
            De vermelding van een aanbieder, product of dienst is uitsluitend bedoeld ter informatie. Het betekent niet dat de organisatie het aanbod heeft beoordeeld, goedgekeurd of aanbeveelt. Er wordt geen garantie gegeven op inhoud, kwaliteit of uitvoering. De organisatie is op geen enkele manier aansprakelijk voor gevolgen die voortvloeien uit contact met of gebruik van het aanbod.
          </p>
        </div>

        <BenefitFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          benefit={benefit}
          supplierOrgId={benefit.supplier_org_id || undefined}
        />
      </main>
    </div>
  );
}
