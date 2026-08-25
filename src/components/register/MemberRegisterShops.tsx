import { Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCoffeeshopRegister, useRegisterLinks } from "@/hooks/useCoffeeshopRegister";
import { Badge } from "@/components/ui/badge";

/** Toont de coffeeshops uit het landelijke register die aan dit lid gekoppeld zijn. */
const MemberRegisterShops = ({ memberId }: { memberId: number }) => {
  const { isAdmin, isBoard } = useAuth();
  const allowed = isAdmin || isBoard;
  const { data: links = [] } = useRegisterLinks(allowed);
  const { data: shops = [] } = useCoffeeshopRegister(allowed);

  if (!allowed) return null;

  const mine = links.filter((l) => l.member_id === memberId && l.status !== "afgewezen");
  if (mine.length === 0) return null;

  const shopById = new Map(shops.map((s) => [s.id, s]));

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
        <Building2 size={16} className="text-brand-red" /> Gelieerde coffeeshops (register)
      </h3>
      <ul className="space-y-2">
        {mine.map((l) => {
          const shop = shopById.get(l.register_id);
          if (!shop) return null;
          return (
            <li key={l.id} className="flex items-start justify-between gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
              <div>
                <p className="font-medium">{shop.naam}</p>
                <p className="text-muted-foreground text-xs">
                  {[shop.plaats, shop.vergunninghouder].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <Badge variant={l.status === "bevestigd" ? "default" : "secondary"}>
                {l.status === "bevestigd" ? "Bevestigd" : "Voorstel"}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default MemberRegisterShops;
