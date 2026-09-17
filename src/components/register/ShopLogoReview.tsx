import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getShopLogoStatus,
  setShopLogoApproval,
  uploadShopLogo,
} from "@/lib/shopLogo.functions";

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Bestand kon niet gelezen worden"));
    reader.readAsDataURL(file);
  });

/**
 * Beoordelen van het logo van één coffeeshop: goedkeuren, afkeuren of een
 * aangeleverd bestand uploaden. Alleen goedgekeurde logo's gaan publiek.
 */
const ShopLogoReview = ({
  registerId,
  enabled = true,
}: {
  registerId: string;
  enabled?: boolean;
}) => {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getShopLogoStatus);
  const approveFn = useServerFn(setShopLogoApproval);
  const uploadFn = useServerFn(uploadShopLogo);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [cacheBust, setCacheBust] = useState(() => Date.now());

  const { data: status, isLoading } = useQuery({
    queryKey: ["shop-logo-status", registerId],
    enabled,
    queryFn: () => fetchStatus({ data: { register_id: registerId } }),
  });

  const refresh = () => {
    setCacheBust(Date.now());
    queryClient.invalidateQueries({ queryKey: ["shop-logo-status", registerId] });
    queryClient.invalidateQueries({ queryKey: ["member-register-logos"] });
  };

  const approve = useMutation({
    mutationFn: (approved: boolean) =>
      approveFn({ data: { register_id: registerId, approved } }),
    onSuccess: (_d, approved) => {
      refresh();
      toast.success(approved ? "Logo goedgekeurd" : "Logo afgekeurd en verwijderd");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("Alleen afbeeldingen");
      if (file.size > 5 * 1024 * 1024) throw new Error("Maximaal 5 MB");
      return uploadFn({
        data: {
          register_id: registerId,
          filename: file.name,
          contentType: file.type,
          base64: await toBase64(file),
        },
      });
    },
    onSuccess: () => {
      refresh();
      toast.success("Logo geüpload en goedgekeurd");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!enabled) return null;

  const busy = approve.isPending || upload.isPending;
  const heeftLogo = !!(status?.logo_pad || status?.logo_url);
  const src = status?.logo_pad
    ? `/api/public/shop-logo/${registerId}?v=${cacheBust}`
    : status?.logo_url ?? null;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-start gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
          {isLoading ? (
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          ) : src ? (
            <img
              src={src}
              alt="Logo van deze coffeeshop"
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <span className="px-1 text-center text-[10px] text-muted-foreground">Geen logo</span>
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium">
            {status?.logo_gecontroleerd ? "Logo goedgekeurd" : "Logo nog niet goedgekeurd"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || !heeftLogo || status?.logo_gecontroleerd}
              onClick={() => approve.mutate(true)}
            >
              <Check size={14} /> Logo goedkeuren
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !heeftLogo}
              onClick={() => approve.mutate(false)}
            >
              <X size={14} /> Logo afkeuren
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={14} /> Logo uploaden
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload.mutate(file);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Goedgekeurde logo's staan binnen vijf minuten op coffeeshopbond.nl.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShopLogoReview;
