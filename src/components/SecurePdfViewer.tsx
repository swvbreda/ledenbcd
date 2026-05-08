import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, LayoutGrid, List, ChevronDown, ChevronRight as ChevronRightSm } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createEdgeScrollDetector } from "./edgeScrollDetector";

// Use CDN worker matching installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface Props {
  url?: string;
  data?: ArrayBuffer | Uint8Array;
  watermarkText?: string;
}

export default function SecurePdfViewer({ url, data }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1); // user zoom multiplier (1 = fit screen)
  const [fitScale, setFitScale] = useState(1); // auto-computed to fill container (width & height)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const [showThumbs, setShowThumbs] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
  );
  const [showOutline, setShowOutline] = useState(false);
  const [outline, setOutline] = useState<any[] | null>(null);
  const [links, setLinks] = useState<{ x: number; y: number; w: number; h: number; dest: any }[]>([]);
  const [pageSize, setPageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const pendingScrollY = useRef<number | null>(null);

  const goToDest = async (dest: any) => {
    if (!pdf) return;
    const r = await resolveDest(pdf, dest);
    if (!r) return;
    pendingScrollY.current = r.y; // PDF-space Y (top = high), null = top
    if (r.page === pageNum) {
      // Same page: scroll immediately
      applyPendingScroll();
    } else {
      setPageNum(r.page);
    }
  };

  const applyPendingScroll = () => {
    const c = containerRef.current;
    if (!c) return;
    const yPdf = pendingScrollY.current;
    if (yPdf == null || !canvasEl) {
      c.scrollTo({ top: 0, left: 0 });
    } else {
      // Convert PDF-space y (origin bottom-left) to CSS pixels (matches canvas style size)
      const renderScale = fitScale * scale;
      const pageHeightCss = parseFloat(canvasEl.style.height || `${canvasEl.height}`);
      const pageHeightPdf = pageHeightCss / renderScale;
      const offsetPx = (pageHeightPdf - yPdf) * renderScale;
      c.scrollTo({ top: Math.max(0, offsetPx - 8), left: 0 });
    }
    c.scrollIntoView({ block: "start", behavior: "smooth" });
    pendingScrollY.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const loadingTask = data
          ? pdfjsLib.getDocument({ data: data instanceof Uint8Array ? data : new Uint8Array(data) })
          : pdfjsLib.getDocument({ url: url! });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
        try {
          const ol = await doc.getOutline();
          if (!cancelled) setOutline(ol ?? []);
        } catch {
          if (!cancelled) setOutline([]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Kon PDF niet laden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url, data]);

  useEffect(() => {
    if (!pdf || !canvasEl) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const renderScale = fitScale * scale;
      const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      const viewport = page.getViewport({ scale: renderScale });
      const hiResViewport = page.getViewport({ scale: renderScale * dpr });
      const canvas = canvasEl;
      const ctx = canvas.getContext("2d")!;
      canvas.width = hiResViewport.width;
      canvas.height = hiResViewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      await page.render({ canvasContext: ctx, viewport: hiResViewport, canvas } as any).promise;
      if (cancelled) return;
      // Scroll to pending sub-target (or top of page) after render
      applyPendingScroll();
      if (cancelled) return;
      // Collect internal link annotations
      try {
        const annots = await page.getAnnotations();
        if (cancelled) return;
        const linkAnnots: { x: number; y: number; w: number; h: number; dest: any }[] = [];
        for (const a of annots as any[]) {
          if (a.subtype !== "Link") continue;
          const dest = a.dest ?? a.action;
          if (!dest) continue;
          // a.rect is [x1,y1,x2,y2] in PDF coordinates; convert with viewport
          const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(a.rect);
          const x = Math.min(x1, x2);
          const y = Math.min(y1, y2);
          const w = Math.abs(x2 - x1);
          const h = Math.abs(y2 - y1);
          linkAnnots.push({ x, y, w, h, dest });
        }
        setLinks(linkAnnots);
        setPageSize({ w: viewport.width, h: viewport.height });
      } catch {
        setLinks([]);
      }
    })();
    return () => { cancelled = true; };
  }, [pdf, pageNum, scale, fitScale, canvasEl]);

  // Compute fit-to-width scale based on container width and current page's intrinsic size.
  useEffect(() => {
    if (!pdf) return;
    const c = containerRef.current;
    if (!c) return;
    let cancelled = false;
    let raf = 0;
    const recompute = async () => {
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const availW = Math.max(100, c.clientWidth - 4);
      // Use the viewer's max-height budget so the page fills the screen vertically too
      const availH = Math.max(200, c.clientHeight - 4);
      const fitW = availW / base.width;
      const fitH = availH / base.height;
      const fit = Math.min(fitW, fitH);
      setFitScale((prev) => (Math.abs(prev - fit) < 0.001 ? prev : fit));
    };
    recompute();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    });
    ro.observe(c);
    return () => { cancelled = true; ro.disconnect(); cancelAnimationFrame(raf); };
  }, [pdf, pageNum, showThumbs, showOutline]);

  useEffect(() => {
    let blockTimeout: number | undefined;
    const setProtectiveBlur = (active: boolean) => {
      wrapperRef.current?.toggleAttribute("data-protected", active);
      setBlurred(active);
    };
    const triggerBlock = () => {
      window.clearTimeout(blockTimeout);
      setProtectiveBlur(true);
      setHidden(true);
      blockTimeout = window.setTimeout(() => {
        setHidden(false);
        setProtectiveBlur(false);
      }, 2200);
    };
    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const screenshotModifierChord = (e.metaKey || e.ctrlKey) && e.shiftKey;
      if (screenshotModifierChord) {
        setProtectiveBlur(true);
      }
      if ((e.ctrlKey || e.metaKey) && (k === "s" || k === "p" || k === "u" || k === "c")) {
        e.preventDefault();
        triggerBlock();
      }
      if (k === "printscreen") {
        e.preventDefault();
        triggerBlock();
      }
      // macOS screenshot shortcuts: Cmd+Shift+3/4/5/6
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && ["3","4","5","6"].includes(k)) {
        e.preventDefault();
        triggerBlock();
      }
      if (k === "arrowright" || k === "pagedown") {
        setPageNum((p) => Math.min(numPages, p + 1));
      }
      if (k === "arrowleft" || k === "pageup") {
        setPageNum((p) => Math.max(1, p - 1));
      }
    };
    const blockCtx = (e: Event) => e.preventDefault();
    const blockAux = (e: MouseEvent) => {
      // Middle-click / aux-click would open links in a new tab
      if (e.button !== 0) e.preventDefault();
    };
    const blockCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerBlock();
    };
    const onBlur = () => setBlurred(true);
    const onFocus = () => setBlurred(false);
    const onVis = () => setBlurred(document.hidden);
    const onKeyUp = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
        setProtectiveBlur(false);
      }
    };
    window.addEventListener("keydown", blockKeys, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("copy", blockCopy);
    const el = containerRef.current;
    el?.addEventListener("contextmenu", blockCtx);
    el?.addEventListener("dragstart", blockCtx);
    el?.addEventListener("auxclick", blockAux);
    el?.addEventListener("mousedown", blockAux);
    return () => {
      window.clearTimeout(blockTimeout);
      wrapperRef.current?.removeAttribute("data-protected");
      window.removeEventListener("keydown", blockKeys, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("copy", blockCopy);
      el?.removeEventListener("contextmenu", blockCtx);
      el?.removeEventListener("dragstart", blockCtx);
      el?.removeEventListener("auxclick", blockAux);
      el?.removeEventListener("mousedown", blockAux);
    };
  }, [numPages]);

  // Wheel / touch: scroll past the bottom -> next page, past the top -> previous page
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const detector = createEdgeScrollDetector({ threshold: 80, cooldown: 600 });
    const trigger = (dir: 1 | -1) => {
      if (dir === 1 && pageNum < numPages) {
        pendingScrollY.current = null; // top of next page
        setPageNum((p) => Math.min(numPages, p + 1));
      } else if (dir === -1 && pageNum > 1) {
        pendingScrollY.current = 0; // bottom of previous page
        setPageNum((p) => Math.max(1, p - 1));
      }
    };
    const atTop = () => c.scrollTop <= 0;
    const atBottom = () => c.scrollTop + c.clientHeight >= c.scrollHeight - 1;

    const onWheel = (e: WheelEvent) => {
      const r = detector.feed(e.deltaY, atTop(), atBottom());
      if (r === "next") { e.preventDefault(); trigger(1); }
      else if (r === "prev") { e.preventDefault(); trigger(-1); }
      else if ((e.deltaY > 0 && atBottom()) || (e.deltaY < 0 && atTop())) {
        // Prevent the page itself from scrolling while we're collecting intent
        e.preventDefault();
      }
    };

    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
      detector.reset();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchY == null) return;
      const cy = e.touches[0]?.clientY ?? touchY;
      const dy = touchY - cy; // >0 swipe up (scroll down)
      touchY = cy;
      const r = detector.feed(dy, atTop(), atBottom());
      if (r === "next") trigger(1);
      else if (r === "prev") trigger(-1);
    };
    const onTouchEnd = () => { touchY = null; detector.reset(); };

    c.addEventListener("wheel", onWheel, { passive: false });
    c.addEventListener("touchstart", onTouchStart, { passive: true });
    c.addEventListener("touchmove", onTouchMove, { passive: true });
    c.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      c.removeEventListener("wheel", onWheel as any);
      c.removeEventListener("touchstart", onTouchStart as any);
      c.removeEventListener("touchmove", onTouchMove as any);
      c.removeEventListener("touchend", onTouchEnd as any);
    };
  }, [pageNum, numPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  if (error) {
    return <div className="text-center py-12 text-destructive text-sm">{error}</div>;
  }

  return (
    <div ref={wrapperRef} className="secure-pdf-wrap">
      <style>{`
        @media print {
          .secure-pdf-wrap { display: none !important; }
        }
        .secure-pdf-wrap { user-select: none; -webkit-user-select: none; }
        .secure-pdf-wrap canvas { -webkit-user-drag: none; pointer-events: none; }
        .secure-pdf-wrap[data-protected] canvas { filter: blur(34px) !important; }
      `}</style>

      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center justify-center gap-2 mb-3 flex-wrap py-2 border-b border-primary/30">
        <Button size="sm" variant={showThumbs ? "default" : "outline"} onClick={() => setShowThumbs((v) => !v)} aria-label="Pagina-overzicht">
          <LayoutGrid size={16} />
        </Button>
        {outline && outline.length > 0 && (
          <Button size="sm" variant={showOutline ? "default" : "outline"} onClick={() => setShowOutline((v) => !v)} aria-label="Inhoudsopgave">
            <List size={16} />
          </Button>
        )}
        <span className="w-2" />
        <Button size="sm" variant="outline" onClick={() => setPageNum((p) => Math.max(1, p - 1))} disabled={pageNum <= 1}>
          <ChevronLeft size={16} />
        </Button>
        <span className="text-sm tabular-nums px-2">
          {pageNum} / {numPages}
        </span>
        <Button size="sm" variant="outline" onClick={() => setPageNum((p) => Math.min(numPages, p + 1))} disabled={pageNum >= numPages}>
          <ChevronRight size={16} />
        </Button>
        <span className="w-2" />
        <Button size="sm" variant="outline" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}>
          <ZoomOut size={16} />
        </Button>
        <span className="text-xs tabular-nums w-10 text-center">{Math.round(scale * 100)}%</span>
        <Button size="sm" variant="outline" onClick={() => setScale((s) => Math.min(3, s + 0.2))}>
          <ZoomIn size={16} />
        </Button>
      </div>

      <div className="flex gap-3 items-start justify-center">
        {showThumbs && pdf && (
          <ThumbnailSidebar
            pdf={pdf}
            current={pageNum}
            onSelect={(p) => setPageNum(p)}
          />
        )}
        {showOutline && pdf && outline && outline.length > 0 && (
          <OutlineSidebar
            pdf={pdf}
            items={outline}
            currentPage={pageNum}
            onSelectDest={(d) => goToDest(d)}
          />
        )}
        <div
          ref={containerRef}
          className="relative mx-auto overflow-auto border-2 border-primary/60 rounded-md bg-muted/30 flex justify-center w-full max-w-4xl"
          style={{ maxHeight: "calc(100vh - 140px)" }}
        >
        <div className="relative inline-block">
          <canvas
            ref={setCanvasEl}
            style={{
              filter: hidden || blurred ? "blur(28px)" : "none",
              transition: "none",
            }}
          />
          {(hidden || blurred) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-background/95 border-2 border-primary/60 rounded-md px-4 py-3 max-w-[90%] text-center shadow-lg">
                <p className="text-sm font-semibold text-foreground">
                  Beeld tijdelijk geblokkeerd
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Het maken van schermafbeeldingen en kopieën van dit document is niet toegestaan.
                </p>
              </div>
            </div>
          )}
          {/* Click zones for prev/next page */}
          <button
            type="button"
            aria-label="Vorige pagina"
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize disabled:cursor-not-allowed bg-transparent"
          />
          <button
            type="button"
            aria-label="Volgende pagina"
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
            disabled={pageNum >= numPages}
            className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize disabled:cursor-not-allowed bg-transparent"
          />
          {/* Internal link hotspots — enlarged for touch (min 44px) */}
          {!hidden && pdf && links.map((lnk, i) => {
            const MIN = 44;
            const padX = Math.max(0, (MIN - lnk.w) / 2);
            const padY = Math.max(0, (MIN - lnk.h) / 2);
            return (
              <button
                key={i}
                type="button"
                aria-label="Ga naar hoofdstuk"
                onClick={() => goToDest(lnk.dest)}
                className="absolute cursor-pointer touch-manipulation flex items-center justify-center group"
                style={{
                  left: lnk.x - padX,
                  top: lnk.y - padY,
                  width: lnk.w + padX * 2,
                  height: lnk.h + padY * 2,
                  padding: 0,
                  background: "transparent",
                }}
              >
                <span
                  className="rounded-sm group-hover:bg-primary/15 group-active:bg-primary/25 transition-colors"
                  style={{ width: lnk.w, height: lnk.h }}
                />
              </button>
            );
          })}
        </div>
        </div>
      </div>

    </div>
  );
}

function ThumbnailSidebar({
  pdf,
  current,
  onSelect,
}: {
  pdf: pdfjsLib.PDFDocumentProxy;
  current: number;
  onSelect: (p: number) => void;
}) {
  return (
    <div className="w-32 max-h-[80vh] overflow-y-auto border-2 border-primary/60 rounded-md bg-card p-2 space-y-2 shrink-0">
      {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((p) => (
        <Thumbnail
          key={p}
          pdf={pdf}
          pageNum={p}
          active={p === current}
          onClick={() => onSelect(p)}
        />
      ))}
    </div>
  );
}

function Thumbnail({
  pdf,
  pageNum,
  active,
  onClick,
}: {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  active: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNum);
      if (cancelled || !ref.current) return;
      const viewport = page.getViewport({ scale: 0.2 });
      const canvas = ref.current;
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    })();
    return () => { cancelled = true; };
  }, [pdf, pageNum]);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded border-2 transition ${active ? "border-primary" : "border-transparent hover:border-primary/40"}`}
      aria-label={`Ga naar pagina ${pageNum}`}
    >
      <canvas ref={ref} className="block w-full bg-white" />
      <span className="block text-[10px] text-center tabular-nums py-0.5 text-muted-foreground">
        {pageNum}
      </span>
    </button>
  );
}

/**
 * Resolves any PDF destination to { page, y } where y is the PDF-space Y
 * coordinate of the target (top of page = highest Y). Returns null if no
 * page reference can be resolved.
 */
async function resolveDest(
  pdf: pdfjsLib.PDFDocumentProxy,
  dest: any,
): Promise<{ page: number; y: number | null } | null> {
  try {
    if (dest == null) return null;
    if (typeof dest === "string") {
      const resolved = await pdf.getDestination(dest);
      return resolveDest(pdf, resolved);
    }
    if (!Array.isArray(dest)) {
      if (typeof dest === "object") {
        if ("num" in dest && "gen" in dest) {
          const idx = await pdf.getPageIndex(dest as any);
          return { page: idx + 1, y: null };
        }
        if ("dest" in dest) return resolveDest(pdf, (dest as any).dest);
      }
      return null;
    }
    // Explicit dest array: [pageRef, fitType, ...args]
    const ref = dest[0];
    let page: number | null = null;
    if (typeof ref === "number" && Number.isFinite(ref)) {
      page = ref + 1;
    } else if (ref && typeof ref === "object" && "num" in ref && "gen" in ref) {
      try {
        page = (await pdf.getPageIndex(ref as any)) + 1;
      } catch { /* ignore */ }
    } else if (Array.isArray(ref) || typeof ref === "string") {
      const inner = await resolveDest(pdf, ref);
      if (inner) return inner;
    }
    if (!page) return null;

    // Try to extract a Y coordinate. Common fit types:
    //   [page, /XYZ, x, y, zoom]   → dest[3] = y
    //   [page, /FitH, y]           → dest[2] = y
    //   [page, /FitBH, y]          → dest[2] = y
    let y: number | null = null;
    const fit = dest[1];
    const fitName = fit && typeof fit === "object" && "name" in fit ? (fit as any).name : fit;
    if (fitName === "XYZ" && typeof dest[3] === "number") y = dest[3];
    else if ((fitName === "FitH" || fitName === "FitBH") && typeof dest[2] === "number") y = dest[2];

    return { page, y };
  } catch {
    return null;
  }
}

async function destToPage(pdf: pdfjsLib.PDFDocumentProxy, dest: any): Promise<number | null> {
  const r = await resolveDest(pdf, dest);
  return r ? r.page : null;
}

function OutlineSidebar({
  pdf,
  items,
  currentPage,
  onSelectDest,
}: {
  pdf: pdfjsLib.PDFDocumentProxy;
  items: any[];
  currentPage: number;
  onSelectDest: (dest: any) => void;
}) {
  // Resolve every outline entry to a page number once
  const [pageMap, setPageMap] = useState<Map<any, number>>(new Map());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = new Map<any, number>();
      const walk = async (entries: any[]) => {
        for (const entry of entries) {
          const p = await destToPage(pdf, entry.dest);
          if (p) map.set(entry, p);
          if (Array.isArray(entry.items) && entry.items.length > 0) {
            await walk(entry.items);
          }
        }
      };
      await walk(items);
      if (!cancelled) setPageMap(map);
    })();
    return () => { cancelled = true; };
  }, [pdf, items]);

  // Active = entry with the highest page <= currentPage
  let activeEntry: any = null;
  let activePage = -1;
  pageMap.forEach((p, entry) => {
    if (p <= currentPage && p > activePage) {
      activePage = p;
      activeEntry = entry;
    }
  });

  const activeRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeEntry]);

  return (
    <div className="w-64 max-h-[80vh] overflow-y-auto border-2 border-primary/60 rounded-md bg-card p-2 shrink-0 text-sm">
      <p className="text-xs font-semibold text-muted-foreground px-1 pb-2">Inhoudsopgave</p>
      <OutlineList
        pdf={pdf}
        items={items}
        onSelectDest={onSelectDest}
        depth={0}
        activeEntry={activeEntry}
        activeRef={activeRef}
      />
    </div>
  );
}

function OutlineList({
  pdf,
  items,
  onSelectDest,
  depth,
  activeEntry,
  activeRef,
}: {
  pdf: pdfjsLib.PDFDocumentProxy;
  items: any[];
  onSelectDest: (dest: any) => void;
  depth: number;
  activeEntry: any;
  activeRef: React.RefObject<HTMLLIElement>;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item, i) => (
        <OutlineItem
          key={i}
          pdf={pdf}
          item={item}
          onSelectDest={onSelectDest}
          depth={depth}
          activeEntry={activeEntry}
          activeRef={activeRef}
        />
      ))}
    </ul>
  );
}

function OutlineItem({
  pdf,
  item,
  onSelectDest,
  depth,
  activeEntry,
  activeRef,
}: {
  pdf: pdfjsLib.PDFDocumentProxy;
  item: any;
  onSelectDest: (dest: any) => void;
  depth: number;
  activeEntry: any;
  activeRef: React.RefObject<HTMLLIElement>;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = Array.isArray(item.items) && item.items.length > 0;
  const isActive = item === activeEntry;
  const handleClick = () => onSelectDest(item.dest);
  return (
    <li ref={isActive ? activeRef : undefined}>
      <div
        className={`flex items-start gap-1 rounded ${isActive ? "border-l-4 border-primary bg-primary/10" : "border-l-4 border-transparent"}`}
        style={{ paddingLeft: depth * 8 + 4 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
            aria-label={open ? "Inklappen" : "Uitklappen"}
          >
            {open ? <ChevronDown size={12} /> : <ChevronRightSm size={12} />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <button
          type="button"
          onClick={handleClick}
          aria-current={isActive ? "true" : undefined}
          className={`text-left text-xs leading-snug py-1 hover:text-primary flex-1 px-1 ${isActive ? "text-primary font-semibold" : ""}`}
        >
          {item.title}
          {isActive && <span className="ml-1 text-[10px] uppercase tracking-wide">• huidig</span>}
        </button>
      </div>
      {hasChildren && open && (
        <OutlineList
          pdf={pdf}
          items={item.items}
          onSelectDest={onSelectDest}
          depth={depth + 1}
          activeEntry={activeEntry}
          activeRef={activeRef}
        />
      )}
    </li>
  );
}