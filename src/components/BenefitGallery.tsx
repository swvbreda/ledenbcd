import { useState } from "react";
import { getBenefitImageUrl } from "@/hooks/useBenefits";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  id: string;
  image_path: string;
  caption: string | null;
  sort_order: number;
}

interface Props {
  /** Main product image_path (from member_benefits table) */
  mainImagePath: string | null;
  /** Additional gallery images */
  galleryImages: GalleryImage[];
  alt: string;
}

export default function BenefitGallery({ mainImagePath, galleryImages, alt }: Props) {
  // Combine main image + gallery images into one list
  const allImages: { url: string; caption: string | null }[] = [];

  const mainUrl = getBenefitImageUrl(mainImagePath);
  if (mainUrl) allImages.push({ url: mainUrl, caption: null });

  galleryImages
    .sort((a, b) => a.sort_order - b.sort_order)
    .forEach((img) => {
      const url = getBenefitImageUrl(img.image_path);
      if (url) allImages.push({ url, caption: img.caption });
    });

  const [activeIndex, setActiveIndex] = useState(0);

  if (allImages.length === 0) {
    return (
      <div className="rounded-xl overflow-hidden bg-muted border border-border aspect-square flex items-center justify-center">
        <div className="text-7xl font-bold text-muted-foreground/20">{alt.charAt(0)}</div>
      </div>
    );
  }

  const current = allImages[activeIndex] || allImages[0];
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < allImages.length - 1;

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative rounded-xl overflow-hidden bg-muted border border-border aspect-square flex items-center justify-center group">
        <img
          src={current.url}
          alt={current.caption || alt}
          className="w-full h-full object-contain p-4"
        />

        {/* Arrows */}
        {allImages.length > 1 && (
          <>
            {hasPrev && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full shadow-md"
                onClick={() => setActiveIndex((i) => i - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {hasNext && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full shadow-md"
                onClick={() => setActiveIndex((i) => i + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </>
        )}

        {/* Counter */}
        {allImages.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-xs font-medium px-2 py-1 rounded-full border border-border">
            {activeIndex + 1} / {allImages.length}
          </div>
        )}
      </div>

      {/* Caption */}
      {current.caption && (
        <p className="text-xs text-muted-foreground text-center">{current.caption}</p>
      )}

      {/* Thumbnails */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                i === activeIndex
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
