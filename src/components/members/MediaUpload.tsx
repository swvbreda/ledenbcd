import { useRef, useState } from "react";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { validateImage } from "@/hooks/useMemberMedia";

interface MediaUploadProps {
  /** Huidige afbeelding (signed URL) of null */
  url: string | null;
  /** Naam waaruit initialen worden afgeleid */
  naam: string;
  /** true = ronde avatar (contactpersoon), false = afgerond vierkant (logo) */
  round?: boolean;
  size?: number;
  canEdit?: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
}

const initialsOf = (naam: string) =>
  naam
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const MediaUpload = ({
  url,
  naam,
  round = true,
  size = 48,
  canEdit = false,
  onUpload,
  onRemove,
}: MediaUploadProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    const err = validateImage(file);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
      toast.success("Afbeelding opgeslagen");
    } catch (e) {
      console.error(e);
      toast.error("Uploaden mislukt");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setBusy(true);
    try {
      await onRemove();
      toast.success("Afbeelding verwijderd");
    } catch (e) {
      console.error(e);
      toast.error("Verwijderen mislukt");
    } finally {
      setBusy(false);
    }
  };

  const shape = round ? "rounded-full" : "rounded-lg";

  return (
    <div className="relative shrink-0 group" style={{ width: size, height: size }}>
      <div
        className={`${shape} overflow-hidden border border-border bg-muted flex items-center justify-center w-full h-full`}
      >
        {url ? (
          <img
            src={url}
            alt={round ? `Foto van ${naam}` : `Logo van ${naam}`}
            className={round ? "w-full h-full object-cover" : "w-full h-full object-contain p-1"}
            loading="lazy"
          />
        ) : (
          <span
            className="font-display font-bold text-muted-foreground"
            style={{ fontSize: Math.max(11, size / 3) }}
          >
            {initialsOf(naam)}
          </span>
        )}
      </div>

      {busy && (
        <div className={`absolute inset-0 ${shape} bg-background/70 flex items-center justify-center`}>
          <Loader2 size={size / 3} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {canEdit && !busy && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleFile(file);
            }}
          />
          <button
            type="button"
            aria-label={url ? "Afbeelding vervangen" : "Afbeelding toevoegen"}
            onClick={() => inputRef.current?.click()}
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground border-2 border-background flex items-center justify-center hover:opacity-90"
          >
            <Camera size={12} />
          </button>
          {url && onRemove && (
            <button
              type="button"
              aria-label="Afbeelding verwijderen"
              onClick={handleRemove}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground border-2 border-background hidden group-hover:flex items-center justify-center hover:opacity-90"
            >
              <Trash2 size={10} />
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default MediaUpload;
