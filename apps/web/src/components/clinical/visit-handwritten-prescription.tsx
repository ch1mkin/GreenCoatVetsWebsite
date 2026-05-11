"use client";

import { toBlob as domToBlob } from "html-to-image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { saveHandwrittenVisitPdfAction } from "@/app/(portal)/visits/visit-report-actions";
import { VisitHandwrittenHtmlSheet } from "@/components/clinical/visit-handwritten-html-sheet";
import type {
  HandwrittenVisitCheckboxId,
  HandwrittenVisitPoint,
  HandwrittenVisitSheetState,
} from "@/lib/visits/handwritten-visit-sheet";
import {
  HANDWRITTEN_VISIT_SHEET_HEIGHT,
  HANDWRITTEN_VISIT_SHEET_WIDTH,
} from "@/lib/visits/handwritten-visit-sheet";

type InkTool = "draw" | "erase" | "highlight";
type Tool = InkTool | "scroll";
type ToolbarPosition = { x: number; y: number };
type StrokeBounds = { x: number; y: number; width: number; height: number };
type StrokeLike = { id: string; width: number; points: HandwrittenVisitPoint[] };
type EditorSnapshot = HandwrittenVisitSheetState;

const EXPORT_MIME = "image/jpeg";
const TOOLBAR_DEFAULT_POS: ToolbarPosition = { x: 20, y: 20 };
const TOOLBAR_MARGIN = 12;

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => {
            image.removeEventListener("load", done);
            image.removeEventListener("error", done);
            resolve();
          };
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

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

function applyToolbarPosition(toolbar: HTMLDivElement | null, pos: ToolbarPosition) {
  if (!toolbar) return;
  toolbar.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
}

function cloneStroke(stroke: StrokeLike): StrokeLike {
  return {
    id: stroke.id,
    width: stroke.width,
    points: stroke.points.map((point) => ({ ...point })),
  };
}

function cloneSheetState(state: HandwrittenVisitSheetState): HandwrittenVisitSheetState {
  return {
    version: state.version,
    fields: { ...state.fields },
    checkboxes: { ...state.checkboxes },
    wordTokens: [],
    highlights: state.highlights.map(cloneStroke),
    inkFallbacks: state.inkFallbacks.map(cloneStroke),
  };
}

function buildPath(points: HandwrittenVisitPoint[]) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function getStrokeBounds(points: HandwrittenVisitPoint[]): StrokeBounds | null {
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function boundsIntersect(a: StrokeBounds, b: StrokeBounds) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function VisitHandwrittenPrescription({
  visitId,
  embed,
  hasSavedPdf,
  clinicName,
  petName,
  ownerName,
  doctorName,
  initialState,
}: {
  visitId: string;
  embed: boolean;
  hasSavedPdf: boolean;
  clinicName: string;
  petName: string;
  ownerName: string;
  doctorName: string;
  initialState: HandwrittenVisitSheetState;
}) {
  const router = useRouter();
  const studioRef = useRef<HTMLDivElement | null>(null);
  const fullscreenToolbarRef = useRef<HTMLDivElement | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const checkboxRefs = useRef<Partial<Record<HandwrittenVisitCheckboxId, HTMLInputElement | null>>>({});
  const activePointerId = useRef<number | null>(null);
  const activeStrokeRef = useRef<StrokeLike | null>(null);
  const toolbarDragPointerId = useRef<number | null>(null);
  const toolbarDragOffset = useRef<HandwrittenVisitPoint | null>(null);
  const fullscreenToolbarPosRef = useRef<ToolbarPosition>(TOOLBAR_DEFAULT_POS);
  const pendingToolbarPosRef = useRef<ToolbarPosition | null>(null);
  const toolbarDragRafRef = useRef<number | null>(null);

  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<Tool>("draw");
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [editorState, setEditorState] = useState<HandwrittenVisitSheetState>(() => cloneSheetState(initialState));
  const [currentStroke, setCurrentStroke] = useState<StrokeLike | null>(null);
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [fullscreenToolbarPos, setFullscreenToolbarPos] = useState<ToolbarPosition>(TOOLBAR_DEFAULT_POS);
  const [toolbarDragActive, setToolbarDragActive] = useState(false);

  const scrollMode = tool === "scroll";

  const registerCheckboxRef = useCallback((checkboxId: HandwrittenVisitCheckboxId, node: HTMLInputElement | null) => {
    checkboxRefs.current[checkboxId] = node;
  }, []);

  const createSnapshot = useCallback(
    (): EditorSnapshot => cloneSheetState(editorState),
    [editorState],
  );

  const restoreSnapshot = useCallback((snapshot: EditorSnapshot) => {
    setEditorState(cloneSheetState(snapshot));
  }, []);

  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((prev) => [...prev, createSnapshot()]);
    setRedoStack([]);
  }, [createSnapshot]);

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
      fullscreenToolbarPosRef.current = TOOLBAR_DEFAULT_POS;
      setFullscreenToolbarPos(TOOLBAR_DEFAULT_POS);
      return;
    }
    const updateToolbarBounds = () => {
      const next = clampToolbarPosition(fullscreenToolbarPosRef.current, fullscreenToolbarRef.current);
      fullscreenToolbarPosRef.current = next;
      applyToolbarPosition(fullscreenToolbarRef.current, next);
      setFullscreenToolbarPos(next);
    };
    updateToolbarBounds();
    window.addEventListener("resize", updateToolbarBounds);
    return () => {
      window.removeEventListener("resize", updateToolbarBounds);
    };
  }, [fullscreenActive]);

  useEffect(() => {
    fullscreenToolbarPosRef.current = fullscreenToolbarPos;
    applyToolbarPosition(fullscreenToolbarRef.current, fullscreenToolbarPos);
  }, [fullscreenToolbarPos]);

  useEffect(() => {
    if (!toolbarDragActive) return;

    const flushPendingToolbarPosition = () => {
      if (toolbarDragRafRef.current !== null) {
        window.cancelAnimationFrame(toolbarDragRafRef.current);
        toolbarDragRafRef.current = null;
      }
      const next = pendingToolbarPosRef.current;
      if (!next) return;
      pendingToolbarPosRef.current = null;
      fullscreenToolbarPosRef.current = next;
      applyToolbarPosition(fullscreenToolbarRef.current, next);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (toolbarDragPointerId.current !== event.pointerId || !toolbarDragOffset.current) return;
      const next = clampToolbarPosition(
        {
          x: event.clientX - toolbarDragOffset.current.x,
          y: event.clientY - toolbarDragOffset.current.y,
        },
        fullscreenToolbarRef.current,
      );
      pendingToolbarPosRef.current = next;
      if (toolbarDragRafRef.current !== null) return;
      toolbarDragRafRef.current = window.requestAnimationFrame(() => {
        toolbarDragRafRef.current = null;
        const framePos = pendingToolbarPosRef.current;
        if (!framePos) return;
        pendingToolbarPosRef.current = null;
        fullscreenToolbarPosRef.current = framePos;
        applyToolbarPosition(fullscreenToolbarRef.current, framePos);
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      if (toolbarDragPointerId.current !== event.pointerId) return;
      flushPendingToolbarPosition();
      toolbarDragPointerId.current = null;
      toolbarDragOffset.current = null;
      setFullscreenToolbarPos(fullscreenToolbarPosRef.current);
      setToolbarDragActive(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      flushPendingToolbarPosition();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [toolbarDragActive]);

  const startToolbarDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = fullscreenToolbarRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
    toolbarDragPointerId.current = event.pointerId;
    toolbarDragOffset.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setToolbarDragActive(true);
  }, []);

  const getStagePoint = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * HANDWRITTEN_VISIT_SHEET_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HANDWRITTEN_VISIT_SHEET_HEIGHT,
    };
  }, []);

  const getNodeBounds = useCallback((node: Element | null): StrokeBounds | null => {
    const stageNode = stageRef.current;
    if (!node || !stageNode) return null;
    const nodeRect = node.getBoundingClientRect();
    const stageRect = stageNode.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return null;
    return {
      x: ((nodeRect.left - stageRect.left) / stageRect.width) * HANDWRITTEN_VISIT_SHEET_WIDTH,
      y: ((nodeRect.top - stageRect.top) / stageRect.height) * HANDWRITTEN_VISIT_SHEET_HEIGHT,
      width: (nodeRect.width / stageRect.width) * HANDWRITTEN_VISIT_SHEET_WIDTH,
      height: (nodeRect.height / stageRect.height) * HANDWRITTEN_VISIT_SHEET_HEIGHT,
    };
  }, []);

  const pointInBounds = useCallback((point: HandwrittenVisitPoint, bounds: StrokeBounds | null) => {
    if (!bounds) return false;
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  }, []);

  const getCheckboxAtPoint = useCallback((point: HandwrittenVisitPoint): HandwrittenVisitCheckboxId | null => {
    for (const checkboxId of Object.keys(checkboxRefs.current) as HandwrittenVisitCheckboxId[]) {
      const node = checkboxRefs.current[checkboxId];
      const bounds = getNodeBounds(node ?? null);
      if (pointInBounds(point, bounds)) {
        return checkboxId;
      }
    }
    return null;
  }, [getNodeBounds, pointInBounds]);

  const handleCheckboxChange = useCallback((checkboxId: HandwrittenVisitCheckboxId, checked: boolean) => {
    pushUndoSnapshot();
    setEditorState((prev) => ({
      ...prev,
      checkboxes: {
        ...prev.checkboxes,
        [checkboxId]: checked,
      },
    }));
  }, [pushUndoSnapshot]);

  const eraseAtStroke = useCallback((stroke: StrokeLike) => {
    const bounds = getStrokeBounds(stroke.points);
    if (!bounds) return;

    pushUndoSnapshot();
    setEditorState((prev) => {
      const nextState = cloneSheetState(prev);
      nextState.highlights = nextState.highlights.filter((highlight) => {
        const highlightBounds = getStrokeBounds(highlight.points);
        return !highlightBounds || !boundsIntersect(bounds, highlightBounds);
      });
      nextState.inkFallbacks = nextState.inkFallbacks.filter((ink) => {
        if (ink.id === stroke.id) return false;
        const inkBounds = getStrokeBounds(ink.points);
        return !inkBounds || !boundsIntersect(bounds, inkBounds);
      });
      return nextState;
    });
  }, [pushUndoSnapshot]);

  const startStroke = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (tool === "scroll") return;
    const point = getStagePoint(event);
    const checkboxId = getCheckboxAtPoint(point);
    if (checkboxId) {
      handleCheckboxChange(checkboxId, !editorState.checkboxes[checkboxId]);
      return;
    }

    const stroke: StrokeLike = {
      id: crypto.randomUUID(),
      width: tool === "highlight" ? Math.max(18, strokeWidth * 4) : Math.max(4, strokeWidth),
      points: [point],
    };

    activePointerId.current = event.pointerId;
    activeStrokeRef.current = stroke;
    setCurrentStroke(stroke);
    setError(null);
    setMessage(null);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
  }, [editorState.checkboxes, getCheckboxAtPoint, getStagePoint, handleCheckboxChange, strokeWidth, tool]);

  const moveStroke = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (activePointerId.current !== event.pointerId || !activeStrokeRef.current) return;
    const point = getStagePoint(event);
    const nextStroke = {
      ...activeStrokeRef.current,
      points: [...activeStrokeRef.current.points, point],
    };
    activeStrokeRef.current = nextStroke;
    setCurrentStroke(nextStroke);
  }, [getStagePoint]);

  const endStroke = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (activePointerId.current !== event.pointerId || !activeStrokeRef.current) return;
    const stroke = activeStrokeRef.current;
    activePointerId.current = null;
    activeStrokeRef.current = null;
    setCurrentStroke(null);

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }

    if (stroke.points.length < 2) return;

    if (tool === "highlight") {
      pushUndoSnapshot();
      setEditorState((prev) => ({
        ...prev,
        highlights: [...prev.highlights, cloneStroke(stroke)],
      }));
      return;
    }

    if (tool === "erase") {
      eraseAtStroke(stroke);
      return;
    }

    pushUndoSnapshot();
    setEditorState((prev) => ({
      ...prev,
      inkFallbacks: [...prev.inkFallbacks, cloneStroke(stroke)],
    }));
  }, [eraseAtStroke, pushUndoSnapshot, tool]);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      const snapshot = prev[prev.length - 1];
      if (!snapshot) return prev;
      setRedoStack((current) => [...current, createSnapshot()]);
      restoreSnapshot(snapshot);
      return prev.slice(0, -1);
    });
  }, [createSnapshot, restoreSnapshot]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      const snapshot = prev[prev.length - 1];
      if (!snapshot) return prev;
      setUndoStack((current) => [...current, createSnapshot()]);
      restoreSnapshot(snapshot);
      return prev.slice(0, -1);
    });
  }, [createSnapshot, restoreSnapshot]);

  const clearAnnotations = useCallback(() => {
    pushUndoSnapshot();
    setEditorState((prev) => ({
      ...prev,
      highlights: [],
      inkFallbacks: [],
    }));
  }, [pushUndoSnapshot]);

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
    if (!captureRef.current) return;
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      await waitForImages(captureRef.current);

      const imageBlob = await domToBlob(captureRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      if (!imageBlob) throw new Error("Failed to capture the handwritten visit sheet.");

      const fd = new FormData();
      fd.set("visit_id", visitId);
      fd.set("editor_state_json", JSON.stringify(editorState));
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

  const overlayPointerClass = scrollMode ? "pointer-events-none" : "pointer-events-auto touch-none";
  const renderedStrokes = useMemo(
    () => [
      ...editorState.highlights.map((stroke) => ({ ...stroke, color: "#facc15", opacity: 0.35 })),
      ...editorState.inkFallbacks.map((stroke) => ({ ...stroke, color: "#111827", opacity: 0.9 })),
    ],
    [editorState.highlights, editorState.inkFallbacks],
  );

  const toolbarBody = (
    <>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tools</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={toolButtonClass(tool === "draw")} onClick={() => setTool("draw")}>
            Write
          </button>
          <button type="button" className={toolButtonClass(tool === "highlight")} onClick={() => setTool("highlight")}>
            Highlight
          </button>
          <button type="button" className={toolButtonClass(tool === "erase")} onClick={() => setTool("erase")}>
            Erase
          </button>
          <button type="button" className={toolButtonClass(tool === "scroll")} onClick={() => setTool("scroll")}>
            Scroll / Edit
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
          onChange={(event) => setStrokeWidth(Number(event.target.value))}
          className="mt-2 w-full"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary btn-compact text-xs" disabled={!undoStack.length} onClick={undo}>
          Undo
        </button>
        <button type="button" className="btn-secondary btn-compact text-xs" disabled={!redoStack.length} onClick={redo}>
          Redo
        </button>
        <button
          type="button"
          className="btn-secondary btn-compact text-xs"
          disabled={!editorState.highlights.length && !editorState.inkFallbacks.length}
          onClick={clearAnnotations}
        >
          Clear ink
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-600">
        <p className="font-semibold text-slate-800">Tips</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Use Write to handwrite anywhere on the template.</li>
          <li>Use Scroll / Edit to click checkboxes directly and move around the page safely.</li>
          <li>In Write mode, tapping directly on a checkbox still toggles it.</li>
          <li>Highlight stays as marker strokes on top of the visit form.</li>
          <li>Eraser removes handwritten and highlight strokes from the page.</li>
        </ul>
      </div>

      {embed ? <p className="text-[11px] text-slate-500">Embedded visit mode still supports full handwritten save.</p> : null}
    </>
  );

  const fullscreenToolbar = (
    <div
      ref={fullscreenToolbarRef}
      className="absolute left-0 top-0 z-20 w-[122px] will-change-transform rounded-2xl border border-slate-300/80 bg-white/90 p-2 shadow-2xl backdrop-blur"
      style={{ transform: `translate3d(${fullscreenToolbarPos.x}px, ${fullscreenToolbarPos.y}px, 0)` }}
    >
      <button
        type="button"
        className="mb-2 flex w-full cursor-grab touch-none select-none items-center justify-center rounded-lg border border-slate-300/80 bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 active:cursor-grabbing"
        onPointerDown={startToolbarDrag}
      >
        Move
      </button>
      <div className="space-y-2">
        <button type="button" className={compactToolButtonClass(tool === "draw")} onClick={() => setTool("draw")}>
          Write
        </button>
        <button type="button" className={compactToolButtonClass(tool === "highlight")} onClick={() => setTool("highlight")}>
          Mark
        </button>
        <button type="button" className={compactToolButtonClass(tool === "erase")} onClick={() => setTool("erase")}>
          Erase
        </button>
        <button type="button" className={compactToolButtonClass(tool === "scroll")} onClick={() => setTool("scroll")}>
          Edit
        </button>

        <label className="block rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Size</span>
          <input
            type="range"
            min={2}
            max={12}
            step={1}
            value={strokeWidth}
            onChange={(event) => setStrokeWidth(Number(event.target.value))}
            className="mt-1 w-full"
          />
        </label>

        <button type="button" className="w-full rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50" disabled={!undoStack.length} onClick={undo}>
          Undo
        </button>
        <button type="button" className="w-full rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50" disabled={!redoStack.length} onClick={redo}>
          Redo
        </button>
        <button
          type="button"
          className="w-full rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
          disabled={!editorState.highlights.length && !editorState.inkFallbacks.length}
          onClick={clearAnnotations}
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

  const sheetStage = (
    <div ref={captureRef} className="relative inline-block">
      <VisitHandwrittenHtmlSheet
        stageRef={stageRef}
        state={editorState}
        registerCheckboxRef={registerCheckboxRef}
        onCheckboxChange={handleCheckboxChange}
      />
      <svg
        viewBox={`0 0 ${HANDWRITTEN_VISIT_SHEET_WIDTH} ${HANDWRITTEN_VISIT_SHEET_HEIGHT}`}
        className={`absolute inset-0 h-full w-full ${overlayPointerClass}`}
        onPointerDown={startStroke}
        onPointerMove={moveStroke}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
      >
        {renderedStrokes.map((stroke) => (
          <path
            key={stroke.id}
            d={buildPath(stroke.points)}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={stroke.opacity}
          />
        ))}
        {currentStroke ? (
          <path
            d={buildPath(currentStroke.points)}
            fill="none"
            stroke={tool === "highlight" ? "#facc15" : tool === "erase" ? "#ef4444" : "#111827"}
            strokeWidth={currentStroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={tool === "highlight" ? 0.35 : 0.9}
          />
        ) : null}
      </svg>
    </div>
  );

  return (
    <>
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-on-background">Interactive handwritten full visit sheet</p>
            <p className="text-[12px] text-on-surface-variant">
              Use the fixed GreenCoatVets HTML visit form with clickable checkboxes, free handwriting, highlight,
              erase, and PDF save.
            </p>
            <p className="text-[11px] text-on-surface-variant">
              Patient: {petName || "—"} | Owner: {ownerName || "—"} | Doctor: {doctorName || "—"} | Clinic: {clinicName || "—"}
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
              {hasSavedPdf ? "Edit handwritten visit sheet" : "Open handwritten visit sheet"}
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
                <div className="h-full overflow-x-auto overflow-y-auto bg-slate-950 p-4">
                  <div className="flex min-h-full items-start justify-center">{sheetStage}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="font-headline text-base font-bold text-slate-900">Interactive handwritten full visit studio</p>
                    <p className="text-[12px] text-slate-600">
                      Write freely on the fixed HTML form, then save the handwritten page exactly as a PDF.
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

                <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
                  <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
                    <div className="space-y-3">{toolbarBody}</div>
                  </aside>

                  <div className="flex min-h-0 flex-col bg-[#e2e8f0]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                      <div className="text-[12px] text-slate-600">
                        {scrollMode
                          ? "Scroll / Edit mode is on. Click checkboxes and scroll safely."
                          : "Write mode lets you handwrite anywhere on the template."}
                      </div>
                      <button type="button" className="btn-primary btn-compact text-xs" disabled={pending} onClick={() => void savePdf()}>
                        {pending ? "Saving PDF…" : "Save handwritten visit"}
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto p-4">
                      <div className="mx-auto rounded-[24px] bg-white p-3 shadow-xl">{sheetStage}</div>
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
