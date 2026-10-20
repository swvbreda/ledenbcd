import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSafePublicUrl, parsePreview, type LinkPreview } from "./linkPreview";

const MAX_HTML = 512 * 1024;

/** Signed-in users only; fetches public page metadata (no cookies, bounded size/time/redirects). */
export const getLinkPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data }): Promise<LinkPreview | null> => {
    let target = isSafePublicUrl(data.url);
    try {
      for (let hop = 0; target && hop < 4; hop++) {
        const res = await fetch(target.toString(), {
          redirect: "manual",
          signal: AbortSignal.timeout(4000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; BCDLinkPreview/1.0)", Accept: "text/html" },
        });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          await res.body?.cancel();
          target = loc ? isSafePublicUrl(new URL(loc, target).toString()) : null;
          continue;
        }
        if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html") || !res.body) {
          await res.body?.cancel();
          return null;
        }
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          total += value.byteLength;
          if (total >= MAX_HTML) { await reader.cancel(); break; }
        }
        const html = new TextDecoder().decode(await new Blob(chunks as BlobPart[]).arrayBuffer());
        const preview = parsePreview(html, target.toString());
        return preview.title || preview.image ? preview : null;
      }
    } catch {
      return null;
    }
    return null;
  });
