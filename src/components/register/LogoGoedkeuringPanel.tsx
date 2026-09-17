import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Upload, ImageIcon, Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  listShopLogosForReview,
  setShopLogoApproval,
  uploadShopLogo,
  type ShopLogoReviewItem,
} from "@/lib/shopLogo.functions";

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Bestand kon niet gelezen worden"));
    reader.readAsDataURL(file);
  });

/**
 * Beoordelen van alle logo's van aangesloten coffeeshops op één plek.
 * Alleen goedgekeurde logo's verschijnen op coffeeshopbond.nl.
 */
const LogoGoedkeuringPanel = () => {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listShopLogosForReview);
  const approveFn = useServerFn(setShopLogoApproval);
  const uploadFn = useServerFn(uploadShopLogo);

  const [toonGoedgekeurd, setToonGoedgekeurd] = useState(false);
  const [donkereAchtergrond, setDonkereAchtergrond] = useState(false);
  const [donkerPerLogo, setDonkerPerLogo] = useState<Record<string, boolean>>({});
  const [cacheBust, setCacheBust] = useState(() => Date.now());
  const [uploadVoor, setUploadVoor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: items = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["shop-logo-review", toonGoedgekeurd],
    queryFn: () => listFn({ data: { approved: toonGoedgekeurd } }),
  });

  const refresh = () => {
    setCacheBust(Date.now());
    queryClient.invalidateQueries({ queryKey: ["shop-logo-review"] });
    queryClient.invalidateQueries({ queryKey: ["shop-logo-status"] });
    queryClient.invalidateQueries({ queryKey: ["member-register-logos"] });
  };

  const approve = useMutation({
    mutationFn: (v: { registerId: string; approved: boolean }) =>
      approveFn({ data: { register_id: v.registerId, approved: v.approved } }),
    onSuccess: (_d, v) => {
      refresh();
      toast.success(v.approved ? "Logo goedgekeurd" : "Logo afgekeurd en verwijderd");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveAll = useMutation({
    mutationFn: async (lijst: ShopLogoReviewItem[]) => {
      const rij = [...lijst];
      const worker = async () => {
        while (rij.length) {
          const item = rij.shift();
          if (!item) return;
          await approveFn({ data: { register_id: item.register_id, approved: true } });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    },
    onSuccess: () => {
      refresh();
      toast.success("Alle zichtbare logo's goedgekeurd");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async (v: { registerId: string; file: File }) => {
      if (!v.file.type.startsWith("image/")) throw new Error("Alleen afbeeldingen");
      if (v.file.size > 5 * 1024 * 1024) throw new Error("Maximaal 5 MB");
      return uploadFn({
        data: {
          register_id: v.registerId,
          filename: v.file.name,
          contentType: v.file.type,
          base64: await toBase64(v.file),
        },
      });
    },
    onSuccess: () => {
      refresh();
      toast.success("Logo geüpload en goedgekeurd");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = approve.isPending || upload.isPending || approveAll.isPending;

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <ImageIcon size={14} /> Logo's van coffeeshops
          {!toonGoedgekeurd && items.length > 0 && (
            <Badge variant="secondary">{items.length}</Badge>
          )}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setToonGoedgekeurd(!toonGoedgekeurd)}>
            {toonGoedgekeurd ? "Toon te beoordelen" : "Toon goedgekeurde"}
          </Button>
          {!toonGoedgekeurd && items.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={busy}>
                  <Check size={14} /> Alles goedkeuren
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Alle {items.length} logo's goedkeuren?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deze logo's komen dan op coffeeshopbond.nl te staan. Je kunt ze later per stuk
                    weer afkeuren.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction onClick={() => approveAll.mutate(items)}>
                    Goedkeuren
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-4 text-sm text-muted-foreground">Laden...</div>
      ) : isError ? (
        <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm">
          <p className="text-destructive">
            De logo's konden niet worden opgehaald. {(error as Error)?.message}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Opnieuw proberen
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {toonGoedgekeurd ? "Nog geen goedgekeurde logo's" : "Geen logo's die wachten op goedkeuring"}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.register_id} className="flex flex-col gap-2 p-3">
              <div className="flex h-28 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                <img
                  src={`/api/public/shop-logo/${item.register_id}?v=${cacheBust}`}
                  alt={`Logo van ${item.naam}`}
                  loading="lazy"
                  className="h-full w-full object-contain p-2"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold">{item.naam}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.plaats}
                  {item.lid_naam ? ` · ${item.lid_naam}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!item.logo_gecontroleerd && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => approve.mutate({ registerId: item.register_id, approved: true })}
                  >
                    <Check size={14} /> Goedkeuren
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => approve.mutate({ registerId: item.register_id, approved: false })}
                >
                  <X size={14} /> Afkeuren
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setUploadVoor(item.register_id);
                    inputRef.current?.click();
                  }}
                >
                  <Upload size={14} /> Uploaden
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && uploadVoor) upload.mutate({ registerId: uploadVoor, file });
          setUploadVoor(null);
        }}
      />

      <p className="text-xs text-muted-foreground">
        Goedgekeurde logo's staan binnen vijf minuten op coffeeshopbond.nl.
      </p>
    </section>
  );
};

export default LogoGoedkeuringPanel;
