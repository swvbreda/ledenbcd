import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

// Use CDN worker matching installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface Props {
  url: string;
  watermarkText: string;
}

export default function SecurePdfViewer({ url, watermarkText }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Kon PDF niet laden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

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
      }
      if (k === "printscreen") {
        e.preventDefault();
      }
    };
    const blockCtx = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", blockKeys);
    const el = containerRef.current;
    el?.addEventListener("contextmenu", blockCtx);
    el?.addEventListener("dragstart", blockCtx);
    return () => {
      window.removeEventListener("keydown", blockKeys);
      el?.removeEventListener("contextmenu", blockCtx);
      el?.removeEventListener("dragstart", blockCtx);
    };
  }, []);

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

  // Watermark grid
  const watermarkRows = Array.from({ length: 12 });
  const watermarkCols = Array.from({ length: 4 });

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

      <div
        ref={containerRef}
        className="relative mx-auto inline-block max-w-full overflow-auto border-2 border-primary/60 rounded-md bg-muted/30"
        style={{ display: "block" }}
      >
        <div className="relative inline-block">
          <canvas ref={canvasRef} />
          {/* Watermark overlay */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ mixBlendMode: "multiply" }}
          >
            <div
              className="absolute inset-0 flex flex-col justify-around"
              style={{ transform: "rotate(-30deg) scale(1.4)", transformOrigin: "center" }}
            >
              {watermarkRows.map((_, r) => (
                <div key={r} className="flex justify-around whitespace-nowrap">
                  {watermarkCols.map((_, c) => (
                    <span
                      key={c}
                      className="text-xs font-medium"
                      style={{ color: "rgba(163, 22, 33, 0.18)" }}
                    >
                      {watermarkText}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-3 max-w-md mx-auto">
        Dit document is vertrouwelijk en alleen ter inzage. Downloaden, printen en delen is niet toegestaan.
        Elke inzage wordt gelogd.
      </p>
    </div>
  );
}