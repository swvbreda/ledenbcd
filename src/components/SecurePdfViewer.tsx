import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, LayoutGrid, List, ChevronDown, ChevronRight as ChevronRightSm } from "lucide-react";
import { Button } from "@/components/ui/button";

// Use CDN worker matching installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface Props {
  url?: string;
  data?: ArrayBuffer | Uint8Array;
  watermarkText?: string;
}

export default function SecurePdfViewer({ url, data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [showThumbs, setShowThumbs] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [outline, setOutline] = useState<any[] | null>(null);

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
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    })();
    return () => { cancelled = true; };
  }, [pdf, pageNum, scale]);

  // Block right-click, drag, save/print shortcuts
  useEffect(() => {
    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "s" || k === "p" || k === "u")) {
        e.preventDefault();
        setHidden(true);
        setTimeout(() => setHidden(false), 1500);
      }
      if (k === "printscreen") {
        e.preventDefault();
        setHidden(true);
        setTimeout(() => setHidden(false), 1500);
      }
      // macOS screenshot shortcuts: Cmd+Shift+3/4/5/6
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && ["3","4","5","6"].includes(k)) {
        setHidden(true);
        setTimeout(() => setHidden(false), 1500);
      }
      if (k === "arrowright" || k === "pagedown") {
        setPageNum((p) => Math.min(numPages, p + 1));
      }
      if (k === "arrowleft" || k === "pageup") {
        setPageNum((p) => Math.max(1, p - 1));
      }
    };
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(false);
    const onVis = () => setHidden(document.visibilityState !== "visible");
    const blockCtx = (e: Event) => e.preventDefault();
    const blockAux = (e: MouseEvent) => {
      // Middle-click / aux-click would open links in a new tab
      if (e.button !== 0) e.preventDefault();
    };
    window.addEventListener("keydown", blockKeys);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const el = containerRef.current;
    el?.addEventListener("contextmenu", blockCtx);
    el?.addEventListener("dragstart", blockCtx);
    el?.addEventListener("auxclick", blockAux);
    el?.addEventListener("mousedown", blockAux);
    return () => {
      window.removeEventListener("keydown", blockKeys);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      el?.removeEventListener("contextmenu", blockCtx);
      el?.removeEventListener("dragstart", blockCtx);
      el?.removeEventListener("auxclick", blockAux);
      el?.removeEventListener("mousedown", blockAux);
    };
  }, [numPages]);

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
    <div className="secure-pdf-wrap">
      <style>{`
        @media print {
          .secure-pdf-wrap { display: none !important; }
        }
        .secure-pdf-wrap { user-select: none; -webkit-user-select: none; }
        .secure-pdf-wrap canvas { -webkit-user-drag: none; pointer-events: none; }
      `}</style>

      <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
        <Button size="sm" variant={showThumbs ? "default" : "outline"} onClick={() => setShowThumbs((v) => !v)} aria-label="Pagina-overzicht">
          <LayoutGrid size={16} />
        </Button>
        <Button size="sm" variant={showOutline ? "default" : "outline"} onClick={() => setShowOutline((v) => !v)} aria-label="Inhoudsopgave" disabled={!outline || outline.length === 0}>
          <List size={16} />
        </Button>
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

      <div className="flex gap-3 items-start">
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
            onSelect={(p) => setPageNum(p)}
          />
        )}
        <div
          ref={containerRef}
          className="relative mx-auto inline-block max-w-full overflow-auto border-2 border-primary/60 rounded-md bg-muted/30 flex-1"
          style={{ display: "block" }}
        >
        <div className="relative inline-block">
          <canvas ref={canvasRef} style={{ visibility: hidden ? "hidden" : "visible" }} />
          {hidden && (
            <div className="absolute inset-0 bg-black flex items-center justify-center text-white text-sm">
              Beeld tijdelijk geblokkeerd
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

async function destToPage(pdf: pdfjsLib.PDFDocumentProxy, dest: any): Promise<number | null> {
  try {
    let resolved = dest;
    if (typeof dest === "string") {
      resolved = await pdf.getDestination(dest);
    }
    if (!resolved) return null;
    const ref = resolved[0];
    const idx = await pdf.getPageIndex(ref);
    return idx + 1;
  } catch {
    return null;
  }
}

function OutlineSidebar({
  pdf,
  items,
  onSelect,
}: {
  pdf: pdfjsLib.PDFDocumentProxy;
  items: any[];
  onSelect: (p: number) => void;
}) {
  return (
    <div className="w-64 max-h-[80vh] overflow-y-auto border-2 border-primary/60 rounded-md bg-card p-2 shrink-0 text-sm">
      <p className="text-xs font-semibold text-muted-foreground px-1 pb-2">Inhoudsopgave</p>
      <OutlineList pdf={pdf} items={items} onSelect={onSelect} depth={0} />
    </div>
  );
}

function OutlineList({
  pdf,
  items,
  onSelect,
  depth,
}: {
  pdf: pdfjsLib.PDFDocumentProxy;
  items: any[];
  onSelect: (p: number) => void;
  depth: number;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item, i) => (
        <OutlineItem key={i} pdf={pdf} item={item} onSelect={onSelect} depth={depth} />
      ))}
    </ul>
  );
}

function OutlineItem({
  pdf,
  item,
  onSelect,
  depth,
}: {
  pdf: pdfjsLib.PDFDocumentProxy;
  item: any;
  onSelect: (p: number) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = Array.isArray(item.items) && item.items.length > 0;
  const handleClick = async () => {
    const p = await destToPage(pdf, item.dest);
    if (p) onSelect(p);
  };
  return (
    <li>
      <div className="flex items-start gap-1" style={{ paddingLeft: depth * 8 }}>
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
          className="text-left text-xs leading-snug py-0.5 hover:text-primary flex-1"
        >
          {item.title}
        </button>
      </div>
      {hasChildren && open && (
        <OutlineList pdf={pdf} items={item.items} onSelect={onSelect} depth={depth + 1} />
      )}
    </li>
  );
}