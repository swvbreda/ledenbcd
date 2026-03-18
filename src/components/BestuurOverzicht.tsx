import { Shield, Mail, Phone, MapPin, User, Camera } from "lucide-react";
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

const bestuursleden: { naam: string; functie: string; lidId?: number; email?: string; bondEmail?: string; telefoon?: string; defaultFoto?: string }[] = [
  { naam: "Simone van Breda", functie: "Voorzitter", bondEmail: "simone@coffeeshopbond.nl", telefoon: "06 46 44 26 67", defaultFoto: simonePhoto },
  { naam: "Joachim Helms", functie: "Bestuurder / Woordvoerder", lidId: 5, bondEmail: "joachim@coffeeshopbond.nl" },
  { naam: "Bernard van Nierop", functie: "Bestuurder / Penningmeester", lidId: 8, bondEmail: "bernard@coffeeshopbond.nl" },
  { naam: "Huub van den Brink", functie: "Bestuurder", lidId: 4, bondEmail: "huub@coffeeshopbond.nl" },
  { naam: "Dorine Buchener", functie: "Bestuurder", lidId: 21, bondEmail: "dorine@coffeeshopbond.nl" },
  { naam: "Stef Couwenberg", functie: "Bestuurder", lidId: 14, bondEmail: "stef@coffeeshopbond.nl" },
];

const slugify = (name: string) =>
  name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const getCities = (member?: Member): string[] => {
  if (!member) return [];
  const cities = new Set<string>();
  for (const loc of member.locaties) {
    const plaats = loc.plaats || member.plaats;
    if (plaats) cities.add(plaats);
  }
  return Array.from(cities).sort();
};

const BestuurOverzicht = ({ members }: BestuurOverzichtProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Find which board member the current user is (match by email)
  const currentUserBoardMember = user?.email
    ? bestuursleden.find(
        (bl) =>
          bl.bondEmail?.toLowerCase() === user.email?.toLowerCase() ||
          bl.email?.toLowerCase() === user.email?.toLowerCase()
      )
    : null;

  // Load photos from storage on mount
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

  const getContact = (bl: typeof bestuursleden[0], member?: Member) => {
    if (bl.telefoon) return { telefoon: bl.telefoon };
    if (!member) return {};
    const contact = member.contacten.find(
      (c) => bl.naam.includes(c.naam) || c.naam.includes(bl.naam.split(" ").pop() || "")
    );
    if (contact) return { telefoon: contact.telefoon };
    return { telefoon: member.telefoon };
  };

  const getPhoto = (bl: typeof bestuursleden[0]) => {
    const slug = slugify(bl.naam);
    if (photos[slug]) return photos[slug];
    if (bl.defaultFoto) return bl.defaultFoto;
    return null;
  };

  const canUpload = (bl: typeof bestuursleden[0]) => {
    if (!user) return false;
    // Board members can upload their own photo
    if (currentUserBoardMember?.naam === bl.naam) return true;
    // Admins can upload any photo
    return false;
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold font-display flex items-center gap-2">
          <Shield size={16} className="text-primary" />
          Bestuur BCD
        </h3>
        <span className="text-xs text-muted-foreground">Opgericht 12 januari 1994</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {bestuursleden.map((bl) => {
          const member = bl.lidId ? members.find((m) => m.id === bl.lidId) : undefined;
          const contact = getContact(bl, member);
          const cities = getCities(member);
          const photo = getPhoto(bl);
          const showUpload = canUpload(bl);

          return (
            <div
              key={bl.naam}
              className={`border border-border rounded-md p-3 transition-colors ${
                member ? "hover:bg-muted/30 cursor-pointer" : ""
              }`}
              onClick={() => member && navigate(`/leden/${member.id}`)}
            >
              <div className="flex items-start gap-3 flex-row-reverse">
                <div className="relative shrink-0">
                  {photo ? (
                    <img
                      src={photo}
                      alt={bl.naam}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User size={18} className="text-muted-foreground" />
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
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                        title="Foto uploaden"
                      >
                        <Camera size={10} />
                      </button>
                    </>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{bl.naam}</p>
                  <p className="text-xs text-muted-foreground">{bl.functie}</p>
                </div>
              </div>
              {member && (
                <p className="text-xs text-primary mt-1.5">{member.naam}</p>
              )}
              {cities.length > 0 && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin size={11} className="shrink-0" />
                  {cities.join(", ")}
                </p>
              )}
              <div className="mt-2 space-y-0.5">
                {bl.bondEmail && (
                  <a
                    href={`mailto:${bl.bondEmail}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline transition-colors"
                  >
                    <Mail size={11} /> {bl.bondEmail}
                  </a>
                )}
                {contact.telefoon && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone size={11} /> {contact.telefoon}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BestuurOverzicht;