import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLinkPreview } from "@/lib/linkPreview.functions";

const FIRST_URL = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]']/;

export function firstUrl(text: string): string | null {
  return FIRST_URL.exec(text)?.[0] ?? null;
}

/** WhatsApp-like preview (image + title) for the first link in a text. */
export function LinkPreviewCard({ url }: { url: string }) {
  const fetchPreview = useServerFn(getLinkPreview);
  const { data } = useQuery({
    queryKey: ["link-preview", url],
    queryFn: () => fetchPreview({ data: { url } }),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
  if (!data) return null;
  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer"
      className="block max-w-md overflow-hidden rounded-md border bg-muted/40 hover:bg-muted">
      {data.image && (
        <img src={data.image} alt="" loading="lazy" referrerPolicy="no-referrer"
          className="aspect-[1.91/1] w-full object-cover"
          onError={(e) => { e.currentTarget.style.display = "none"; }} />
      )}
      <div className="space-y-1 p-3">
        {data.site && <p className="text-xs uppercase tracking-wide text-muted-foreground">{data.site}</p>}
        {data.title && <p className="line-clamp-2 text-sm font-semibold">{data.title}</p>}
        {data.description && <p className="line-clamp-2 text-xs text-muted-foreground">{data.description}</p>}
      </div>
    </a>
  );
}
