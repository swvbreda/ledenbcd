import { Shield, Mail, Phone, User, Camera, Users, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import type { Member } from "@/data/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import simonePhoto from "@/assets/bestuur/simone-van-breda.jpg";

interface BestuurOverzichtProps {
  members: Member[];
}

interface BestuurslidData {
  naam: string;
  functie: string;
  lidId?: number;
  email?: string;
  bondEmail?: string;
  telefoon?: string;
  defaultFoto?: string;
  priveAdres?: string;
  privePostcode?: string;
  privePlaats?: string;
  geboortedatum?: string;
  coffeeshop?: string;
  coffeeshopPlaats?: string;
}

const bestuursleden: BestuurslidData[] = [
  { naam: "Simone van Breda", functie: "Voorzitter", bondEmail: "simone@coffeeshopbond.nl", telefoon: "06 46 44 26 67", defaultFoto: simonePhoto, priveAdres: "De Weterungsbrugmolen 3", privePostcode: "1188 GV", privePlaats: "Amstelveen" },
  { naam: "Joachim Helms", functie: "Bestuurder / Woordvoerder", lidId: 5, bondEmail: "joachim@coffeeshopbond.nl", email: "joahelms@gmail.com", telefoon: "06 55 86 76 90", priveAdres: "Haarlemmerstraat 64", privePostcode: "1013 ET", privePlaats: "Amsterdam", coffeeshop: "Greenhouse", coffeeshopPlaats: "Amsterdam" },
  { naam: "Bernard van Nierop", functie: "Bestuurder / Penningmeester", lidId: 8, bondEmail: "bernard@coffeeshopbond.nl", email: "info@coffeeshop-relax.nl", telefoon: "06 25 26 27 30", priveAdres: "Graafwillemlaan 48", privePostcode: "1181 EH", privePlaats: "Amstelveen", geboortedatum: "25-02-1973", coffeeshop: "Relax", coffeeshopPlaats: "Amsterdam" },
  { naam: "Huub van den Brink", functie: "Bestuurder", lidId: 4, bondEmail: "huub@coffeeshopbond.nl", email: "huub@splif.nl", telefoon: "06 53 22 91 20", priveAdres: "Westwijk 11", privePlaats: "Middenbeemster", coffeeshop: "Splif", coffeeshopPlaats: "Noord-Beemster" },
  { naam: "Dorine Buchener", functie: "Bestuurder", lidId: 21, bondEmail: "dorine@coffeeshopbond.nl", email: "dorine@vanhamholding.com", telefoon: "06 57 59 65 34", priveAdres: "Julianastraat 48", privePostcode: "1165 GW", privePlaats: "Halfweg", coffeeshop: "Hunters", coffeeshopPlaats: "Amsterdam" },
  { naam: "Stef Couwenberg", functie: "Bestuurder", lidId: 14, bondEmail: "stef@coffeeshopbond.nl", telefoon: "06 11 39 69 86", priveAdres: "Welle 2", privePostcode: "5507NX", privePlaats: "Veldhoven", geboortedatum: "21-05-1980", coffeeshop: "The Pink", coffeeshopPlaats: "Eindhoven" },
];

const aspiranten: BestuurslidData[] = [
  { naam: "Tim de Wilde", functie: "Kandidaat Bestuurslid", telefoon: "06 30 01 19 65", privePlaats: "Amersfoort", coffeeshop: "Loods", coffeeshopPlaats: "Zwolle / Amersfoort" },
  { naam: "Hannes Poppinghaus", functie: "Woordvoerder Arnhem", bondEmail: "arnhem@coffeeshopbond.nl", telefoon: "06 43 20 68 88", privePlaats: "Arnhem", coffeeshop: "Lucky Luke", coffeeshopPlaats: "Arnhem" },
  { naam: "Tugrulhan", functie: "Woordvoerder Enschede", bondEmail: "enschede@coffeeshopbond.nl", telefoon: "06 48 56 80 81", privePlaats: "Enschede", coffeeshop: "Cafe de Mix", coffeeshopPlaats: "Enschede" },
];

const slugify = (name: string) =>
  name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const BestuurOverzicht = ({ members }: BestuurOverzichtProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const allBestuursleden = [...bestuursleden, ...aspiranten];

  const currentUserBoardMember = user?.email
    ? allBestuursleden.find(
        (bl) =>
          bl.bondEmail?.toLowerCase() === user.email?.toLowerCase() ||
          bl.email?.toLowerCase() === user.email?.toLowerCase()
      )
    : null;

  useEffect(() => {
    const loadPhotos = async () => {
      const { data } = await supabase.storage.from("bestuur-photos").list();
      if (!data) return;
      const photoMap: Record<string, string> = {};
      for (const file of data) {
        const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
        const { data: urlData } = supabase.storage
          .from("bestuur-photos")
          .getPublicUrl(file.name);
        if (urlData?.publicUrl) {
          photoMap[nameWithoutExt] = urlData.publicUrl + "?t=" + file.updated_at;
        }
      }
      setPhotos(photoMap);
    };
    loadPhotos();
  }, []);

  const handleUpload = async (blNaam: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecteer een afbeelding");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Afbeelding mag maximaal 5MB zijn");
      return;
    }
    const slug = slugify(blNaam);
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${slug}.${ext}`;
    setUploading(blNaam);
    const { error } = await supabase.storage
      .from("bestuur-photos")
      .upload(filePath, file, { upsert: true });
    if (error) {
      toast.error("Upload mislukt: " + error.message);
    } else {
      const { data: urlData } = supabase.storage
        .from("bestuur-photos")
        .getPublicUrl(filePath);
      if (urlData?.publicUrl) {
        setPhotos((prev) => ({ ...prev, [slug]: urlData.publicUrl + "?t=" + Date.now() }));
      }
      toast.success("Foto geüpload!");
    }
    setUploading(null);
  };

  const getPhoto = (bl: BestuurslidData) => {
    const slug = slugify(bl.naam);
    if (photos[slug]) return photos[slug];
    if (bl.defaultFoto) return bl.defaultFoto;
    return null;
  };

  const canUpload = (bl: BestuurslidData) => {
    if (!user) return false;
    if (currentUserBoardMember?.naam === bl.naam) return true;
    return false;
  };

  const renderCard = (bl: BestuurslidData, isAspirant = false) => {
    const member = bl.lidId ? members.find((m) => m.id === bl.lidId) : undefined;
    const photo = getPhoto(bl);
    const showUpload = canUpload(bl);

    return (
      <div
        key={bl.naam}
        className={`border rounded-md p-2.5 transition-colors flex gap-2.5 ${
          isAspirant ? "border-dashed border-border" : "border-border"
        } ${member ? "hover:bg-muted/40 cursor-pointer" : ""}`}
        onClick={() => member && navigate(`/leden/${member.id}`)}
      >
        {/* Left content */}
        <div className="min-w-0 flex-1 flex flex-col justify-between">
          <div>
            <p className="font-medium text-sm leading-tight">{bl.naam}</p>
            <p className="text-[11px] text-primary font-medium leading-tight">{bl.functie}</p>
            
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
              {bl.bondEmail && (
                <a
                  href={`mailto:${bl.bondEmail}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:underline truncate max-w-[180px] sm:max-w-none"
                >
                  <Mail size={10} className="shrink-0" /> <span className="truncate">{bl.bondEmail}</span>
                </a>
              )}
              {bl.telefoon && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                  <Phone size={10} /> {bl.telefoon}
                </span>
              )}
            </div>
          </div>

          {(member || bl.coffeeshop) && (() => {
            let locations: string[] = [];
            if (member) {
              const uniqueCities = [...new Set(member.locaties?.map(l => l.plaats).filter(Boolean) || [])];
              locations = uniqueCities.length > 0 ? uniqueCities as string[] : (member.plaats ? [member.plaats] : []);
            } else if (bl.coffeeshopPlaats) {
              locations = bl.coffeeshopPlaats.split("/").map(s => s.trim());
            }
            return (
              <div className="mt-1.5 pt-1.5 border-t border-border/50 space-y-0.5">
                {member && (
                  <p className="text-[11px] font-medium leading-tight">{member.naam}</p>
                )}
                {!member && bl.coffeeshop && (
                  <p className="text-[11px] font-medium leading-tight">{bl.coffeeshop}</p>
                )}
                {locations.length > 0 && (
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    <MapPin size={8} className="inline shrink-0 text-primary/60 mr-0.5" />
                    {locations.join(" · ")}
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* Right photo */}
        <div className="relative shrink-0 self-start">
          {photo ? (
            <img src={photo} alt={bl.naam} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <User size={22} className="text-muted-foreground/60" />
            </div>
          )}
          {showUpload && (
            <>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={(el) => { fileInputRefs.current[bl.naam] = el; }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(bl.naam, file);
                  e.target.value = "";
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRefs.current[bl.naam]?.click();
                }}
                disabled={uploading === bl.naam}
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm"
                title="Foto uploaden"
              >
                <Camera size={10} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold font-display flex items-center gap-2">
          <Shield size={16} className="text-primary" />
          Bestuur
          <a href="mailto:bestuur@coffeeshopbond.nl" className="text-[11px] font-normal text-primary hover:underline flex items-center gap-1">
            <Mail size={10} /> bestuur@coffeeshopbond.nl
          </a>
        </h3>
        <span className="text-xs text-muted-foreground">Opgericht 12 januari 1994</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mb-3 ml-[26px] text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/70">Secretariaat</span>
        <a href="mailto:info@coffeeshopbond.nl" className="flex items-center gap-1 hover:underline">
          <Mail size={10} className="shrink-0" /> info@coffeeshopbond.nl
        </a>
        <a href="tel:+31686875231" className="flex items-center gap-1 hover:underline">
          <Phone size={10} className="shrink-0" /> 06 86 87 52 31
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {bestuursleden.map((bl) => renderCard(bl))}
      </div>

      {aspiranten.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-4 mb-2">
            <Users size={12} className="text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Aspirant</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {aspiranten.map((bl) => renderCard(bl, true))}
          </div>
        </>
      )}
    </div>
  );
};

export default BestuurOverzicht;