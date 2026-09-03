import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Store, ExternalLink } from "lucide-react";
import { useSetRegisterLink, type RegisterLink, type RegisterShop } from "@/hooks/useCoffeeshopRegister";
import { useMembersData } from "@/contexts/MembersDataContext";

type Voorstel = RegisterLink & { shop: RegisterShop | null };

function usePendingRegisterLinks() {
  return useQuery({
    queryKey: ["coffeeshop-register-links", "voorstellen"],
    queryFn: async (): Promise<Voorstel[]> => {
      const { data: links, error } = await supabase
        .from("coffeeshop_member_links")
        .select("*")
        .eq("status", "voorstel")
        .order("match_score", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((links ?? []).map((l: any) => l.register_id)));
      let shops: any[] = [];
      if (ids.length) {
        const { data: shopRows, error: shopErr } = await supabase
          .from("coffeeshop_register")
          .select("*")
          .in("id", ids);
        if (shopErr) throw shopErr;
        shops = shopRows ?? [];
      }
      const byId = new Map(shops.map((s) => [s.id, s]));
      return (links ?? []).map((l: any) => ({ ...l, shop: byId.get(l.register_id) ?? null }));
    },
  });
}

export default function RegisterLinkApprovals() {
  const navigate = useNavigate();
  const { data: voorstellen, isLoading, refetch } = usePendingRegisterLinks();
  const { rawMembers } = useMembersData();
  const setLink = useSetRegisterLink();

  const handle = async (v: Voorstel, status: "bevestigd" | "afgewezen") => {
    await setLink.mutateAsync({
      register_id: v.register_id,
      member_id: v.member_id,
      status,
      existingId: v.id,
      previousStatus: "voorstel",
    });
    refetch();
  };

  const count = voorstellen?.length ?? 0;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        <Store size={14} /> Registerkoppelingen
        {count > 0 && <Badge variant="secondary">{count}</Badge>}
      </h2>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4">Laden...</div>
      ) : count === 0 ? (
        <div className="bg-card rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          Geen koppelingen om te controleren
        </div>
      ) : (
        <div className="space-y-3">
          {voorstellen!.map((v) => {
            const member = rawMembers.find((m) => m.id === v.member_id);
            const adres = v.shop
              ? [v.shop.straat, v.shop.huisnummer, v.shop.huisnummer_toevoeging].filter(Boolean).join(" ")
              : "";
            const memberLoc = member?.locaties?.find(
              (l) =>
                (l.postcode ?? "").replace(/\s/g, "").toUpperCase() ===
                (v.shop?.postcode ?? "").replace(/\s/g, "").toUpperCase(),
            );
            return (
              <Card key={v.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium font-display">{v.shop?.naam ?? "Onbekende shop"}</span>
                  <Badge variant="outline">{v.match_reden ?? "Voorstel"}</Badge>
                  <Badge variant="secondary">{Math.round((v.match_score ?? 0) * 100)}%</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="border border-border rounded-md p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Register</p>
                    {adres && <p>{adres}</p>}
                    <p className="text-muted-foreground">
                      {v.shop?.postcode} {v.shop?.plaats}
                    </p>
                    {v.shop?.vergunninghouder && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Vergunninghouder: {v.shop.vergunninghouder}
                      </p>
                    )}
                  </div>
                  <div className="border border-border rounded-md p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Voorgesteld lid
                    </p>
                    <p className="font-medium">
                      {member ? `#${member.id} ${member.naam}` : `Lid #${v.member_id}`}
                    </p>
                    {memberLoc ? (
                      <p className="text-muted-foreground">
                        {memberLoc.adres} {memberLoc.postcode} {memberLoc.plaats}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">{member?.plaats}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handle(v, "bevestigd")} disabled={setLink.isPending}>
                    <Check size={14} className="mr-1" /> Koppelen
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handle(v, "afgewezen")}
                    disabled={setLink.isPending}
                  >
                    <X size={14} className="mr-1" /> Afwijzen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate("/coffeeshopregister")}>
                    <ExternalLink size={14} className="mr-1" /> In register bekijken
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
