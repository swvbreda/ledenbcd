import { Badge } from "@/components/ui/badge";
import type { RegisterLink, RegisterShop } from "@/hooks/useCoffeeshopRegister";

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;

/** Registergegevens van één vestiging, getoond binnen de locatiekaart van het lid. */
const LocationRegisterInfo = ({
  link,
  shop,
}: {
  link?: RegisterLink | null;
  shop?: RegisterShop | null;
}) => {
  if (!link || !shop) {
    return (
      <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
        Niet gekoppeld aan het landelijke register
      </p>
    );
  }

  const adres = [shop.straat, shop.huisnummer, shop.huisnummer_toevoeging].filter(Boolean).join(" ");

  return (
    <div className="mt-2 border-t border-border pt-2 space-y-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Register</span>
        <Badge variant={link.status === "bevestigd" ? "default" : "secondary"} className="text-[10px]">
          {link.status === "bevestigd" ? "Bevestigd" : "Voorstel"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {shop.naam}
        {adres && <> · {adres}</>}
        {shop.plaats && <> · {shop.plaats}</>}
      </p>
      {shop.vergunninghouder && (
        <p className="text-xs text-muted-foreground">Vergunninghouder: {shop.vergunninghouder}</p>
      )}
      {shop.exploitant && shop.exploitant !== shop.vergunninghouder && (
        <p className="text-xs text-muted-foreground">Exploitant: {shop.exploitant}</p>
      )}
      {(shop.vergunningnummer || shop.vergunningverlening) && (
        <p className="text-xs text-muted-foreground">
          Vergunning {shop.vergunningnummer ?? "—"}
          {shop.vergunningverlening && <> · sinds {fmt(shop.vergunningverlening)}</>}
        </p>
      )}
      <p className="text-xs text-muted-foreground">Status vergunning: {shop.status}</p>
    </div>
  );
};

export default LocationRegisterInfo;
