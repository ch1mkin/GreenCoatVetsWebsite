"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveHandwrittenVisitPdfAction } from "@/app/(portal)/visits/visit-report-actions";

type Point = { x: number; y: number };
type InkTool = "draw" | "erase" | "highlight";
type Tool = InkTool | "scroll";
type Stroke = { id: string; tool: InkTool; width: number; points: Point[] };
type ToolbarPosition = { x: number; y: number };
type ViewportSize = { width: number; height: number };

const CANVAS_W = 1240;
const CANVAS_H = 1754;
const EXPORT_MIME = "image/jpeg";
const EXPORT_QUALITY = 0.92;
const TOOLBAR_DEFAULT_POS: ToolbarPosition = { x: 20, y: 20 };
const TOOLBAR_MARGIN = 12;
const FULLSCREEN_SHEET_MARGIN = 24;

function toolButtonClass(active: boolean) {
  return active
    ? "rounded-xl border border-primary bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm"
    : "rounded-xl border border-outline-variant/25 bg-white px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-low";
}

function compactToolButtonClass(active: boolean) {
  return active
    ? "w-full rounded-lg border border-primary bg-primary px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm"
    : "w-full rounded-lg border border-slate-300/80 bg-white/95 px-2 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50";
}

function clampToolbarPosition(pos: ToolbarPosition, toolbar: HTMLDivElement | null): ToolbarPosition {
  if (typeof window === "undefined") return pos;
  const toolbarWidth = toolbar?.offsetWidth ?? 96;
  const toolbarHeight = toolbar?.offsetHeight ?? 360;
  const maxX = Math.max(TOOLBAR_MARGIN, window.innerWidth - toolbarWidth - TOOLBAR_MARGIN);
  const maxY = Math.max(TOOLBAR_MARGIN, window.innerHeight - toolbarHeight - TOOLBAR_MARGIN);
  return {
    x: Math.min(Math.max(TOOLBAR_MARGIN, pos.x), maxX),
    y: Math.min(Math.max(TOOLBAR_MARGIN, pos.y), maxY),
  };
}

function drawBuiltInTemplate(
  ctx: CanvasRenderingContext2D,
  meta: { clinicName: string; petName: string; ownerName: string; doctorName: string },
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 42px Arial";
  ctx.fillText(meta.clinicName || "Clinic", 86, 92);
  ctx.font = "22px Arial";
  ctx.fillStyle = "#475569";
  ctx.fillText("Handwritten visit sheet", 88, 126);

  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(80, 152);
  ctx.lineTo(CANVAS_W - 80, 152);
  ctx.stroke();

  ctx.fillStyle = "#111827";
  ctx.font = "20px Arial";
  ctx.fillText(`Owner: ${meta.ownerName || "-"}`, 88, 212);
  ctx.fillText(`Patient: ${meta.petName || "-"}`, 88, 252);
  ctx.fillText(`Doctor: ${meta.doctorName || "-"}`, 720, 212);
  ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, 720, 252);

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  const sections = [
    { y: 330, title: "Complaint / History", height: 220 },
    { y: 610, title: "Clinical Findings / Vitals", height: 240 },
    { y: 910, title: "Diagnosis / Treatment / Prescription", height: 330 },
    { y: 1300, title: "Advice / Follow-up / Signature", height: 300 },
  ];

  ctx.font = "bold 24px Arial";
  ctx.fillStyle = "#0f172a";

  for (const section of sections) {
    ctx.fillText(section.title, 88, section.y - 16);
    ctx.strokeRect(80, section.y, CANVAS_W - 160, section.height);
  }

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  for (let y = 380; y <= 510; y += 44) {
    ctx.beginPath();
    ctx.moveTo(105, y);
    ctx.lineTo(CANVAS_W - 105, y);
    ctx.stroke();
  }
  for (let y = 660; y <= 820; y += 44) {
    ctx.beginPath();
    ctx.moveTo(105, y);
    ctx.lineTo(CANVAS_W - 105, y);
    ctx.stroke();
  }
  for (let y = 960; y <= 1170; y += 44) {
    ctx.beginPath();
    ctx.moveTo(105, y);
    ctx.lineTo(CANVAS_W - 105, y);
    ctx.stroke();
  }
  for (let y = 1350; y <= 1530; y += 44) {
    ctx.beginPath();
    ctx.moveTo(105, y);
    ctx.lineTo(CANVAS_W - 105, y);
    ctx.stroke();
  }

  ctx.font = "18px Arial";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Use draw for ink, highlight for marker, and erase to clear strokes.", 88, CANVAS_H - 88);
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (!stroke.points.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.width;

  if (stroke.tool === "erase") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else if (stroke.tool === "highlight") {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#facc15";
  } else {
    ctx.strokeStyle = "#111827";
  }

  ctx.beginPath();
  ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
  for (const point of stroke.points.slice(1)) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.restore();
}

async function loadTemplateImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load template image."));
    img.src = url;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode handwritten visit image."));
      },
      type,
      quality,
    );
  });
}

export function VisitHandwrittenPrescription({
  visitId,
  embed,
  templateImageUrl,
  hasSavedPdf,
  clinicName,
  petName,
  ownerName,
  doctorName,
}: {
  visitId: string;
  embed: boolean;
  templateImageUrl: string | null;
  hasSavedPdf: boolean;
  clinicName: string;
  petName: string;
  ownerName: string;
  doctorName: string;
}) {
  const router = useRouter();
  const studioRef = useRef<HTMLDivElement | null>(null);
  const fullscreenToolbarRef = useRef<HTMLDivElement | null>(null);
  const templateCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const toolbarDragPointerId = useRef<number | null>(null);
  const toolbarDragOffset = useRef<Point | null>(null);
  const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(null);
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<Tool>("draw");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [fullscreenToolbarPos, setFullscreenToolbarPos] = useState<ToolbarPosition>(TOOLBAR_DEFAULT_POS);
  const [toolbarDragActive, setToolbarDragActive] = useState(false);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: CANVAS_W, height: CANVAS_H });

  const meta = useMemo(
    () => ({ clinicName, petName, ownerName, doctorName }),
    [clinicName, doctorName, ownerName, petName],
  );
  const scrollMode = tool === "scroll";

  useEffect(() => {
    let cancelled = false;
    if (!open || !templateImageUrl) {
      setTemplateImage(null);
      return;
    }
    loadTemplateImage(templateImageUrl)
      .then((img) => {
        if (!cancelled) setTemplateImage(img);
      })
      .catch(() => {
        if (!cancelled) setTemplateImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, templateImageUrl]);

  const redrawTemplate = useCallback(() => {
    const canvas = templateCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (templateImage) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(templateImage, 0, 0, CANVAS_W, CANVAS_H);
    } else {
      drawBuiltInTemplate(ctx, meta);
    }
  }, [meta, templateImage]);

  const redrawStrokes = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    for (const stroke of strokes) drawStroke(ctx, stroke);
  }, [strokes]);

  useEffect(() => {
    if (!open) return;
    redrawTemplate();
  }, [open, redrawTemplate]);

  useEffect(() => {
    if (!open) return;
    redrawStrokes();
  }, [open, redrawStrokes]);

  useEffect(() => {
    if (!open) return;
    const redrawAll = () => {
      redrawTemplate();
      redrawStrokes();
    };
    const raf = window.requestAnimationFrame(redrawAll);
    return () => window.cancelAnimationFrame(raf);
  }, [open, fullscreenActive, redrawTemplate, redrawStrokes]);

  useEffect(() => {
    if (!open) {
      setFullscreenActive(false);
      return;
    }
    const onFullscreenChange = () => {
      setFullscreenActive(document.fullscreenElement === studioRef.current);
    };
    onFullscreenChange();
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [open]);

  useEffect(() => {
    if (!fullscreenActive) {
      setFullscreenToolbarPos(TOOLBAR_DEFAULT_POS);
      return;
    }
    const updateToolbarBounds = () => {
      setFullscreenToolbarPos((current) => clampToolbarPosition(current, fullscreenToolbarRef.current));
    };
    updateToolbarBounds();
    window.addEventListener("resize", updateToolbarBounds);
    return () => {
      window.removeEventListener("resize", updateToolbarBounds);
    };
  }, [fullscreenActive]);

  useEffect(() => {
    if (!open) return;
    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    return () => {
      window.removeEventListener("resize", updateViewportSize);
    };
  }, [open]);

  const pointFromEvent = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }, []);

  const startStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool === "scroll") return;
      const point = pointFromEvent(event);
      activePointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      setError(null);
      setMessage(null);
      setRedoStack([]);
      setStrokes((prev) => [
        ...prev,
        { id: crypto.randomUUID(), tool, width: tool === "highlight" ? Math.max(18, strokeWidth * 4) : tool === "erase" ? Math.max(16, strokeWidth * 4) : strokeWidth, points: [point] },
      ]);
    },
    [pointFromEvent, strokeWidth, tool],
  );

  const moveStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointerId.current !== event.pointerId) return;
      const point = pointFromEvent(event);
      setStrokes((prev) => {
        if (!prev.length) return prev;
        const next = [...prev];
        const last = next[next.length - 1];
        if (!last) return prev;
        next[next.length - 1] = { ...last, points: [...last.points, point] };
        return next;
      });
    },
    [pointFromEvent],
  );

  const endStroke = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerId.current !== event.pointerId) return;
    activePointerId.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!toolbarDragActive) return;

    const onPointerMove = (event: PointerEvent) => {
      if (toolbarDragPointerId.current !== event.pointerId || !toolbarDragOffset.current) return;
      const next = clampToolbarPosition(
        {
          x: event.clientX - toolbarDragOffset.current.x,
          y: event.clientY - toolbarDragOffset.current.y,
        },
        fullscreenToolbarRef.current,
      );
      setFullscreenToolbarPos(next);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (toolbarDragPointerId.current !== event.pointerId) return;
      toolbarDragPointerId.current = null;
      toolbarDragOffset.current = null;
      setToolbarDragActive(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [toolbarDragActive]);

  const startToolbarDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = fullscreenToolbarRef.current?.getBoundingClientRect();
    if (!rect) return;
    toolbarDragPointerId.current = event.pointerId;
    toolbarDragOffset.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setToolbarDragActive(true);
  }, []);

  async function toggleFullscreen() {
    if (!studioRef.current) return;
    if (document.fullscreenElement === studioRef.current) {
      await document.exitFullscreen();
      return;
    }
    await studioRef.current.requestFullscreen();
  }

  async function closeStudio() {
    if (document.fullscreenElement === studioRef.current) {
      await document.exitFullscreen();
    }
    setOpen(false);
  }

  async function savePdf() {
    const templateCanvas = templateCanvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    if (!templateCanvas || !drawingCanvas) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = CANVAS_W;
      exportCanvas.height = CANVAS_H;
      const exportCtx = exportCanvas.getContext("2d", { alpha: false });
      if (!exportCtx) throw new Error("Failed to prepare handwritten visit export.");
      exportCtx.fillStyle = "#ffffff";
      exportCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      exportCtx.imageSmoothingEnabled = true;
      exportCtx.imageSmoothingQuality = "high";
      exportCtx.drawImage(templateCanvas, 0, 0);
      exportCtx.drawImage(drawingCanvas, 0, 0);
      const imageBlob = await canvasToBlob(exportCanvas, EXPORT_MIME, EXPORT_QUALITY);
      const fd = new FormData();
      fd.set("visit_id", visitId);
      fd.set("image_file", new File([imageBlob], `visit-${visitId}.jpg`, { type: EXPORT_MIME }));
      const result = await saveHandwrittenVisitPdfAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Handwritten visit PDF saved.");
      router.refresh();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  const sheetCanvasClass = fullscreenActive
    ? "pointer-events-none block w-full bg-white"
    : "pointer-events-none block w-full rounded-[18px] border border-slate-200 bg-white shadow-inner";
  const writingCanvasClass = fullscreenActive
    ? `absolute inset-0 w-full ${scrollMode ? "pointer-events-none" : "touch-none"}`
    : `absolute inset-0 w-full rounded-[18px] ${scrollMode ? "pointer-events-none" : "touch-none"}`;
  const fullscreenSheetStyle = useMemo(() => {
    if (!fullscreenActive) return undefined;
    const maxWidth = Math.max(320, viewportSize.width - FULLSCREEN_SHEET_MARGIN * 2);
    const maxHeight = Math.max(320, viewportSize.height - FULLSCREEN_SHEET_MARGIN * 2);
    const scale = Math.min(maxWidth / CANVAS_W, maxHeight / CANVAS_H);
    return {
      width: `${Math.max(320, Math.floor(CANVAS_W * scale))}px`,
      height: `${Math.max(452, Math.floor(CANVAS_H * scale))}px`,
    };
  }, [fullscreenActive, viewportSize.height, viewportSize.width]);

  const toolbarBody = (
    <>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tools</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={toolButtonClass(tool === "draw")} onClick={() => setTool("draw")}>
            Draw
          </button>
          <button type="button" className={toolButtonClass(tool === "highlight")} onClick={() => setTool("highlight")}>
            Highlight
          </button>
          <button type="button" className={toolButtonClass(tool === "erase")} onClick={() => setTool("erase")}>
            Erase
          </button>
          <button type="button" className={toolButtonClass(tool === "scroll")} onClick={() => setTool("scroll")}>
            Scroll
          </button>
        </div>
      </div>

      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Stroke size</span>
        <input
          type="range"
          min={2}
          max={12}
          step={1}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="mt-2 w-full"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary btn-compact text-xs"
          disabled={!strokes.length}
          onClick={() => {
            setStrokes((prev) => {
              const next = [...prev];
              const removed = next.pop();
              if (removed) setRedoStack((redo) => [...redo, removed]);
              return next;
            });
          }}
        >
          Undo
        </button>
        <button
          type="button"
          className="btn-secondary btn-compact text-xs"
          disabled={!redoStack.length}
          onClick={() => {
            setRedoStack((prev) => {
              const next = [...prev];
              const restored = next.pop();
              if (restored) setStrokes((current) => [...current, restored]);
              return next;
            });
          }}
        >
          Redo
        </button>
        <button
          type="button"
          className="btn-secondary btn-compact text-xs"
          disabled={!strokes.length}
          onClick={() => {
            setRedoStack([]);
            setStrokes([]);
          }}
        >
          Clear
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-600">
        <p className="font-semibold text-slate-800">Tips</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Stylus works automatically where supported.</li>
          <li>Highlight uses a transparent yellow marker.</li>
          <li>Erase only removes your handwriting and keeps the uploaded template untouched.</li>
          <li>Use Scroll mode when you want to move through the page without adding ink.</li>
          <li>Save writes the visit PDF that owners can open from visit reports.</li>
        </ul>
      </div>

      {embed ? <p className="text-[11px] text-slate-500">Embedded visit mode still supports full handwriting save.</p> : null}
    </>
  );

  const fullscreenToolbar = (
    <div
      ref={fullscreenToolbarRef}
      className="absolute z-20 w-[110px] rounded-2xl border border-slate-300/80 bg-white/90 p-2 shadow-2xl backdrop-blur"
      style={{ left: fullscreenToolbarPos.x, top: fullscreenToolbarPos.y }}
    >
      <button
        type="button"
        className="mb-2 flex w-full cursor-grab items-center justify-center rounded-lg border border-slate-300/80 bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 active:cursor-grabbing"
        onPointerDown={startToolbarDrag}
      >
        Move
      </button>
      <div className="space-y-2">
        <button type="button" className={compactToolButtonClass(tool === "draw")} onClick={() => setTool("draw")}>
          Draw
        </button>
        <button type="button" className={compactToolButtonClass(tool === "highlight")} onClick={() => setTool("highlight")}>
          Mark
        </button>
        <button type="button" className={compactToolButtonClass(tool === "erase")} onClick={() => setTool("erase")}>
          Erase
        </button>
        <button type="button" className={compactToolButtonClass(tool === "scroll")} onClick={() => setTool("scroll")}>
          Scroll
        </button>

        <label className="block rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Size</span>
          <input
            type="range"
            min={2}
            max={12}
            step={1}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>

        <button
          type="button"
          className="w-full rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
          disabled={!strokes.length}
          onClick={() => {
            setStrokes((prev) => {
              const next = [...prev];
              const removed = next.pop();
              if (removed) setRedoStack((redo) => [...redo, removed]);
              return next;
            });
          }}
        >
          Undo
        </button>
        <button
          type="button"
          className="w-full rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
          disabled={!redoStack.length}
          onClick={() => {
            setRedoStack((prev) => {
              const next = [...prev];
              const restored = next.pop();
              if (restored) setStrokes((current) => [...current, restored]);
              return next;
            });
          }}
        >
          Redo
        </button>
        <button
          type="button"
          className="w-full rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
          disabled={!strokes.length}
          onClick={() => {
            setRedoStack([]);
            setStrokes([]);
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className="w-full rounded-lg border border-primary bg-primary px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
          disabled={pending}
          onClick={() => void savePdf()}
        >
          {pending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          className="w-full rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700"
          onClick={() => void toggleFullscreen()}
        >
          Exit
        </button>
        <button
          type="button"
          className="w-full rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700"
          onClick={() => void closeStudio()}
        >
          Close
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-on-background">Handwritten full visit sheet</p>
            <p className="text-[12px] text-on-surface-variant">
              Open a full-page writing studio for mouse or stylus input. The saved sheet becomes the visit PDF used for
              report download and owner-facing visit records.
            </p>
            <p className="text-[11px] text-on-surface-variant">
              Background: {templateImageUrl ? "clinic full-visit template image" : "built-in blank visit sheet"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasSavedPdf ? (
              <a
                href={`/visits/${visitId}/report`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary btn-compact text-xs"
              >
                Open saved PDF
              </a>
            ) : null}
            <button type="button" className="btn-primary btn-compact text-xs" onClick={() => setOpen(true)}>
              {hasSavedPdf ? "Edit handwritten visit PDF" : "Open handwriting studio"}
            </button>
          </div>
        </div>
        {message ? <p className="mt-3 text-[11px] font-medium text-emerald-800">{message}</p> : null}
        {error ? (
          <p className="mt-3 rounded-lg border border-error/30 bg-error-container/30 px-3 py-2 text-[11px] text-error">
            {error}
          </p>
        ) : null}
      </div>

      {open ? (
        <div className={`fixed inset-0 z-[120] bg-slate-950/60 ${fullscreenActive ? "p-0" : "p-2 sm:p-4"}`}>
          <div
            ref={studioRef}
            className={`flex h-full flex-col overflow-hidden border border-slate-200 bg-[#f8fafc] shadow-2xl ${
              fullscreenActive ? "rounded-none border-0 bg-slate-950 shadow-none" : "rounded-[28px]"
            }`}
          >
            {fullscreenActive ? (
              <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-950">
                {fullscreenToolbar}
                <div className="h-full overflow-x-auto overflow-y-scroll bg-slate-950">
                  <div className="flex min-h-full items-start justify-center p-3">
                    <div className="relative shrink-0 bg-white shadow-2xl" style={fullscreenSheetStyle}>
                      <canvas
                        ref={templateCanvasRef}
                        width={CANVAS_W}
                        height={CANVAS_H}
                        className={sheetCanvasClass}
                        aria-hidden="true"
                      />
                      <canvas
                        ref={drawingCanvasRef}
                        width={CANVAS_W}
                        height={CANVAS_H}
                        className={writingCanvasClass}
                        onPointerDown={startStroke}
                        onPointerMove={moveStroke}
                        onPointerUp={endStroke}
                        onPointerCancel={endStroke}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="font-headline text-base font-bold text-slate-900">Handwritten full visit studio</p>
                    <p className="text-[12px] text-slate-600">
                      Draw on the whole visit template, then save it as the visit PDF for {petName || "this patient"}.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-outline-variant/25 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                      onClick={() => void toggleFullscreen()}
                    >
                      Full screen
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-outline-variant/25 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                      onClick={() => void closeStudio()}
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
                    <div className="space-y-3">{toolbarBody}</div>
                  </aside>

                  <div className="flex min-h-0 flex-col bg-[#e2e8f0]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                      <div className="text-[12px] text-slate-600">
                        {scrollMode
                          ? "Scroll mode is on. Use the scrollbar or wheel to move through the sheet safely."
                          : templateImageUrl
                            ? "Full visit template image loaded."
                            : "Using built-in blank visit sheet."}
                      </div>
                      <button type="button" className="btn-primary btn-compact text-xs" disabled={pending} onClick={() => void savePdf()}>
                        {pending ? "Saving PDF…" : "Save handwritten full visit"}
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-scroll p-4">
                      <div className="mx-auto max-w-[980px] rounded-[24px] bg-white p-3 shadow-xl">
                        <div className="relative">
                          <canvas
                            ref={templateCanvasRef}
                            width={CANVAS_W}
                            height={CANVAS_H}
                            className={sheetCanvasClass}
                            aria-hidden="true"
                          />
                          <canvas
                            ref={drawingCanvasRef}
                            width={CANVAS_W}
                            height={CANVAS_H}
                            className={writingCanvasClass}
                            onPointerDown={startStroke}
                            onPointerMove={moveStroke}
                            onPointerUp={endStroke}
                            onPointerCancel={endStroke}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
