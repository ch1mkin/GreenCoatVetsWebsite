"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveHandwrittenVisitPdfAction } from "@/app/(portal)/visits/visit-report-actions";

type Point = { x: number; y: number };
type Tool = "draw" | "erase" | "highlight";
type Stroke = { id: string; tool: Tool; width: number; points: Point[] };

const CANVAS_W = 1240;
const CANVAS_H = 1754;

function toolButtonClass(active: boolean) {
  return active
    ? "rounded-xl border border-primary bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm"
    : "rounded-xl border border-outline-variant/25 bg-white px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-low";
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(null);
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<Tool>("draw");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = useMemo(
    () => ({ clinicName, petName, ownerName, doctorName }),
    [clinicName, doctorName, ownerName, petName],
  );

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

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
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

    for (const stroke of strokes) drawStroke(ctx, stroke);
  }, [meta, strokes, templateImage]);

  useEffect(() => {
    if (!open) return;
    redraw();
  }, [open, redraw]);

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

  async function savePdf() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const imageDataUrl = canvas.toDataURL("image/png");
      const fd = new FormData();
      fd.set("visit_id", visitId);
      fd.set("image_data_url", imageDataUrl);
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
        <div className="fixed inset-0 z-[120] bg-slate-950/60 p-2 sm:p-4">
          <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-[#f8fafc] shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="font-headline text-base font-bold text-slate-900">Handwritten full visit studio</p>
                <p className="text-[12px] text-slate-600">
                  Draw on the whole visit template, then save it as the visit PDF for {petName || "this patient"}.
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-outline-variant/25 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tools</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className={toolButtonClass(tool === "draw")} onClick={() => setTool("draw")}>
                        Draw
                      </button>
                      <button
                        type="button"
                        className={toolButtonClass(tool === "highlight")}
                        onClick={() => setTool("highlight")}
                      >
                        Highlight
                      </button>
                      <button type="button" className={toolButtonClass(tool === "erase")} onClick={() => setTool("erase")}>
                        Erase
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
                      <li>Save writes the visit PDF that owners can open from visit reports.</li>
                    </ul>
                  </div>

                  {embed ? <p className="text-[11px] text-slate-500">Embedded visit mode still supports full handwriting save.</p> : null}
                </div>
              </aside>

              <div className="flex min-h-0 flex-col bg-[#e2e8f0]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                  <div className="text-[12px] text-slate-600">
                    {templateImageUrl ? "Full visit template image loaded." : "Using built-in blank visit sheet."}
                  </div>
                  <button type="button" className="btn-primary btn-compact text-xs" disabled={pending} onClick={() => void savePdf()}>
                    {pending ? "Saving PDF…" : "Save handwritten full visit"}
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-4">
                  <div className="mx-auto max-w-[980px] rounded-[24px] bg-white p-3 shadow-xl">
                    <canvas
                      ref={canvasRef}
                      width={CANVAS_W}
                      height={CANVAS_H}
                      className="touch-none w-full rounded-[18px] border border-slate-200 bg-white shadow-inner"
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
        </div>
      ) : null}
    </>
  );
}
