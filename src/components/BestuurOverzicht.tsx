import { Shield, Mail, Phone, User, Camera, Users, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import type { Member } from "@/data/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import simonePhoto from "@/assets/bestuur/simone-van-breda.jpg";

interface BestuurOverzichtProps {
  members: Member[];
}

interface BoardMemberRow {
  id: string;
  naam: string;
  functie: string;
  type: string;
  lid_id: number | null;
  lid_ids: number[] | null;
  email: string | null;
  bond_email: string | null;
  telefoon: string | null;
  coffeeshop: string | null;
  coffeeshop_plaats: string | null;
  sort_order: number;
}

const slugify = (name: string) =>
  name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const BestuurOverzicht = ({ members }: BestuurOverzichtProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [boardMembers, setBoardMembers] = useState<BoardMemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBoard = async () => {
      const { data } = await supabase.rpc("get_board_members_public");
      if (data) setBoardMembers(data as BoardMemberRow[]);
      setLoading(false);
    };
    fetchBoard();
  }, []);

  const bestuursleden = boardMembers.filter((b) => b.type === "bestuurslid");
  const aspiranten = boardMembers.filter((b) => b.type === "aspirant");

  const currentUserBoardMember = user?.email
    ? boardMembers.find(
        (bl) =>
          bl.bond_email?.toLowerCase() === user.email?.toLowerCase() ||
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

  const getPhoto = (bl: BoardMemberRow) => {
    const slug = slugify(bl.naam);
    if (photos[slug]) return photos[slug];
    // Fallback for Simone's hardcoded photo
    if (bl.naam === "Simone van Breda") return simonePhoto;
    return null;
  };

  const canUpload = (bl: BoardMemberRow) => {
    if (!user) return false;
    if (currentUserBoardMember?.naam === bl.naam) return true;
    return false;
  };

  const renderCard = (bl: BoardMemberRow, isAspirant = false) => {
    const lidIds = bl.lid_ids?.length ? bl.lid_ids : (bl.lid_id ? [bl.lid_id] : []);
    const linkedMembers = lidIds.map(id => members.find((m) => m.id === id)).filter(Boolean);
    const firstMember = linkedMembers[0];
    const photo = getPhoto(bl);
    const showUpload = canUpload(bl);

    return (
      <div
        key={bl.id}
        className={`border rounded-md p-2.5 transition-colors flex gap-2.5 ${
          isAspirant ? "border-dashed border-border" : "border-border"
        } ${firstMember ? "hover:bg-muted/40 cursor-pointer" : ""}`}
        onClick={() => firstMember && navigate(`/leden/${firstMember.id}`)}
      >
        <div className="min-w-0 flex-1 flex flex-col justify-between">
          <div>
            <p className="font-medium text-sm leading-tight">{bl.naam}</p>
            <p className="text-[11px] text-primary font-medium leading-tight">{bl.functie}</p>
            
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
              {bl.bond_email && (
                <a
                  href={`mailto:${bl.bond_email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:underline truncate max-w-[180px] sm:max-w-none"
                >
                  <Mail size={10} className="shrink-0" /> <span className="truncate">{bl.bond_email}</span>
                </a>
              )}
              {bl.telefoon && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                  <Phone size={10} /> {bl.telefoon}
                </span>
              )}
            </div>
          </div>

          {(linkedMembers.length > 0 || bl.coffeeshop) && (
            <div className="mt-1.5 pt-1.5 border-t border-border/50 flex flex-wrap gap-x-3 gap-y-1">
              {linkedMembers.length > 0 ? (
                linkedMembers.map((member) => {
                  if (!member) return null;
                  const uniqueCities = [...new Set(member.locaties?.map(l => l.plaats).filter(Boolean) || [])];
                  const locations = uniqueCities.length > 0 ? uniqueCities as string[] : (member.plaats ? [member.plaats] : []);
                  return (
                    <div
                      key={member.id}
                      className="cursor-pointer hover:text-primary transition-colors"
                      onClick={(e) => { e.stopPropagation(); navigate(`/leden/${member.id}`); }}
                    >
                      <p className="text-[11px] font-medium leading-tight whitespace-nowrap">{member.naam}</p>
                      {locations.length > 0 && (
                        <p className="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">
                          <MapPin size={8} className="inline shrink-0 text-primary/60 mr-0.5" />
                          {locations.join(" · ")}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <>
                  {bl.coffeeshop && (
                    <p className="text-[11px] font-medium leading-tight">{bl.coffeeshop}</p>
                  )}
                  {bl.coffeeshop_plaats && (
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      <MapPin size={8} className="inline shrink-0 text-primary/60 mr-0.5" />
                      {bl.coffeeshop_plaats}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
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

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-5">
        <p className="text-sm text-muted-foreground">Bestuur laden...</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-4 sm:p-5">
      <div
        className={`flex items-center justify-between ${isMobile ? "cursor-pointer active:bg-muted/30 -m-4 p-4 rounded-lg transition-colors" : "mb-3"}`}
        onClick={() => isMobile && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap">
          <h3 className="text-sm font-semibold font-display flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            Bestuur
          </h3>
          <span className="hidden sm:inline-flex">
            <a href="mailto:bestuur@coffeeshopbond.nl" className="text-[11px] text-primary hover:underline flex items-center gap-1">
              <Mail size={10} /> bestuur@coffeeshopbond.nl
            </a>
          </span>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">·</span>
          <span className="text-[11px] font-medium text-foreground/70 hidden sm:inline">Secretariaat</span>
          <a href="mailto:info@coffeeshopbond.nl" className="items-center gap-1 text-[11px] text-muted-foreground hover:underline hidden sm:flex">
            <Mail size={10} className="shrink-0" /> info@coffeeshopbond.nl
          </a>
          <a href="tel:+31686875231" className="items-center gap-1 text-[11px] text-muted-foreground hover:underline hidden sm:flex">
            <Phone size={10} className="shrink-0" /> 06 86 87 52 31
          </a>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">Opgericht 12 januari 1994</span>
          {isMobile && (
            <span className={`text-muted-foreground transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}>
              <ChevronDown size={16} />
            </span>
          )}
          {isMobile && !expanded && (
            <span className="text-[11px] text-muted-foreground">{bestuursleden.length + aspiranten.length} leden</span>
          )}
        </div>
      </div>

      {(!isMobile || expanded) && (
        <div className={isMobile ? "mt-3" : ""}>
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
      )}
    </div>
  );
};

export default BestuurOverzicht;
