"use client";

import { toBlob as domToBlob } from "html-to-image";
import type { Canvas as FabricCanvas } from "fabric";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  recognizeHandwrittenRegionAction,
  saveHandwrittenVisitPdfAction,
} from "@/app/(portal)/visits/visit-report-actions";
import { VisitHandwrittenHtmlSheet } from "@/components/clinical/visit-handwritten-html-sheet";
import { prepareHandwrittenRegionOcrPayload } from "@/lib/visits/handwritten-ocr";
import type {
  HandwrittenVisitCheckboxId,
  HandwrittenVisitFieldId,
  HandwrittenVisitPoint,
  HandwrittenVisitRect,
  HandwrittenVisitSheetState,
  HandwrittenVisitWritableRegionState,
} from "@/lib/visits/handwritten-visit-sheet";
import {
  HANDWRITTEN_VISIT_FIELD_IDS,
  HANDWRITTEN_VISIT_SHEET_HEIGHT,
  HANDWRITTEN_VISIT_SHEET_WIDTH,
} from "@/lib/visits/handwritten-visit-sheet";

type InkTool = "draw" | "erase" | "highlight";
type Tool = InkTool | "scroll";
type ToolbarPosition = { x: number; y: number };
type StrokeBounds = HandwrittenVisitRect;
type StrokeLike = { id: string; width: number; points: HandwrittenVisitPoint[] };
type EditorSnapshot = HandwrittenVisitSheetState;
type RegionCanvasMap = Partial<Record<HandwrittenVisitFieldId, FabricCanvas>>;

const EXPORT_MIME = "image/jpeg";
const TOOLBAR_DEFAULT_POS: ToolbarPosition = { x: 20, y: 20 };
const TOOLBAR_MARGIN = 12;
const EMPTY_FABRIC_JSON: Record<string, unknown> = { objects: [] };
const WRITABLE_REGION_LABELS: Record<HandwrittenVisitFieldId, string> = {
  patientName: "Patient name",
  age: "Age",
  ownerName: "Owner name",
  mobile: "Mobile",
  date: "Date",
  ccHp: "CC / HP",
  dewormingText: "Deworming notes",
  vaccinationText: "Vaccination notes",
  rt: "RT",
  rr: "RR",
  hr: "HR",
  crt: "CRT",
  allergic: "Allergic",
  bw: "B/W",
  otherTests: "Other tests",
  physicalExamination: "Physical examination",
  diagnosis: "Diagnosis",
  prescription: "Prescription",
};

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
    ? "flex h-12 w-12 items-center justify-center rounded-2xl border border-primary bg-primary text-white shadow-sm shadow-primary/20"
    : "flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm hover:border-primary/30 hover:bg-slate-50";
}

function compactToolButtonClass(active: boolean) {
  return active
    ? "flex h-12 w-full items-center justify-center rounded-xl border border-primary bg-primary text-white shadow-sm shadow-primary/20"
    : "flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm hover:border-primary/30 hover:bg-slate-50";
}

function ToolIcon({ tool }: { tool: Tool }) {
  if (tool === "draw") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2.2" aria-hidden="true">
        <path d="M4 20l4.5-1 9-9a1.8 1.8 0 0 0 0-2.5l-1-1a1.8 1.8 0 0 0-2.5 0l-9 9L4 20z" />
        <path d="M13 6l5 5" />
      </svg>
    );
  }
  if (tool === "highlight") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2.2" aria-hidden="true">
        <path d="M7 16l7-7 3 3-7 7H7v-3z" />
        <path d="M14 9l2-2 3 3-2 2" />
        <path d="M5 21h8" />
      </svg>
    );
  }
  if (tool === "erase") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2.2" aria-hidden="true">
        <path d="M7 16l7-7 5 5-5 5H9l-2-2a2 2 0 0 1 0-3z" />
        <path d="M14 19h6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2.2" aria-hidden="true">
      <path d="M8 4l1 6 3-2 1 6 3-2 1 8" />
      <path d="M5 11c0-1.7 1.3-3 3-3h3" />
    </svg>
  );
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

function cloneSheetState(state: HandwrittenVisitSheetState): HandwrittenVisitSheetState {
  return JSON.parse(JSON.stringify(state)) as HandwrittenVisitSheetState;
}

function cloneStroke(stroke: StrokeLike): StrokeLike {
  return {
    id: stroke.id,
    width: stroke.width,
    points: stroke.points.map((point) => ({ ...point })),
  };
}

function createEmptyWritableRegionState(): HandwrittenVisitWritableRegionState {
  return {
    mode: "ink",
    text: "",
    ocrText: "",
    fabricJson: null,
    inkBounds: null,
    textBox: null,
    fontSize: null,
  };
}

function buildPath(points: HandwrittenVisitPoint[]) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function hasSerializedFabricObjects(fabricJson: Record<string, unknown> | null | undefined) {
  const objects = fabricJson?.objects;
  return Array.isArray(objects) && objects.length > 0;
}

function canvasHasObjects(canvas: FabricCanvas | null | undefined) {
  return Boolean(canvas?.getObjects().length);
}

function clampRect(bounds: StrokeBounds, maxWidth: number, maxHeight: number): StrokeBounds {
  const x = Math.max(0, Math.min(bounds.x, maxWidth));
  const y = Math.max(0, Math.min(bounds.y, maxHeight));
  const width = Math.max(1, Math.min(bounds.width, maxWidth - x));
  const height = Math.max(1, Math.min(bounds.height, maxHeight - y));
  return { x, y, width, height };
}

function getWritableTextBox(bounds: StrokeBounds, maxWidth: number, maxHeight: number): StrokeBounds {
  return clampRect(
    {
      x: Math.max(0, bounds.x - 4),
      y: Math.max(0, bounds.y - 4),
      width: Math.min(maxWidth, bounds.width + 8),
      height: Math.min(maxHeight, Math.max(bounds.height + 8, bounds.height * 1.25)),
    },
    maxWidth,
    maxHeight,
  );
}

function getWritableFontSize(textBox: StrokeBounds, regionHeight: number) {
  return Math.max(10, Math.min(18, textBox.height * 0.72, regionHeight * 0.6));
}

function getCanvasInkBounds(canvas: FabricCanvas): StrokeBounds | null {
  const objects = canvas.getObjects();
  if (!objects.length) return null;

  let bounds: StrokeBounds | null = null;
  for (const object of objects) {
    const rectSource = (
      object as unknown as {
        getBoundingRect?: (
          absolute?: boolean,
          calculate?: boolean,
        ) => { left: number; top: number; width: number; height: number };
      }
    ).getBoundingRect?.(true, true);
    if (!rectSource) continue;
    const rect = {
      x: rectSource.left,
      y: rectSource.top,
      width: rectSource.width,
      height: rectSource.height,
    };
    bounds = bounds
      ? {
          x: Math.min(bounds.x, rect.x),
          y: Math.min(bounds.y, rect.y),
          width: Math.max(bounds.x + bounds.width, rect.x + rect.width) - Math.min(bounds.x, rect.x),
          height: Math.max(bounds.y + bounds.height, rect.y + rect.height) - Math.min(bounds.y, rect.y),
        }
      : { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  if (!bounds) return null;
  return clampRect(
    {
      x: Math.max(0, bounds.x - 6),
      y: Math.max(0, bounds.y - 6),
      width: bounds.width + 12,
      height: bounds.height + 12,
    },
    canvas.getWidth(),
    canvas.getHeight(),
  );
}

function serializeRegionCanvas(canvas: FabricCanvas) {
  return canvas.toObject() as Record<string, unknown>;
}

function exportRegionCanvasImage(canvas: FabricCanvas, bounds: StrokeBounds) {
  return (
    canvas as unknown as {
      toDataURL: (options: {
        format: string;
        left: number;
        top: number;
        width: number;
        height: number;
        multiplier?: number;
      }) => string;
    }
  ).toDataURL({
    format: "png",
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
    multiplier: 2,
  });
}

export function VisitHandwrittenPrescription({
  visitId,
  embed,
  hasSavedPdf,
  clinicName,
  petName,
  ownerName,
  doctorName,
  logoUrl,
  initialState,
}: {
  visitId: string;
  embed: boolean;
  hasSavedPdf: boolean;
  clinicName: string;
  petName: string;
  ownerName: string;
  doctorName: string;
  logoUrl?: string | null;
  initialState: HandwrittenVisitSheetState;
}) {
  const router = useRouter();
  const studioRef = useRef<HTMLDivElement | null>(null);
  const fullscreenToolbarRef = useRef<HTMLDivElement | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const checkboxRefs = useRef<Partial<Record<HandwrittenVisitCheckboxId, HTMLInputElement | null>>>({});
  const regionCanvasElementsRef = useRef<Partial<Record<HandwrittenVisitFieldId, HTMLCanvasElement | null>>>({});
  const regionCanvasesRef = useRef<RegionCanvasMap>({});
  const fabricModuleRef = useRef<typeof import("fabric") | null>(null);
  const syncingWritableCanvasesRef = useRef(false);
  const editorStateRef = useRef<HandwrittenVisitSheetState>(cloneSheetState(initialState));
  const textEditSnapshotFieldRef = useRef<HandwrittenVisitFieldId | null>(null);
  const activePointerId = useRef<number | null>(null);
  const activeStrokeRef = useRef<StrokeLike | null>(null);
  const toolbarDragPointerId = useRef<number | null>(null);
  const toolbarDragOffset = useRef<HandwrittenVisitPoint | null>(null);
  const fullscreenToolbarPosRef = useRef<ToolbarPosition>(TOOLBAR_DEFAULT_POS);
  const pendingToolbarPosRef = useRef<ToolbarPosition | null>(null);
  const toolbarDragRafRef = useRef<number | null>(null);

  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<Tool>("draw");
  const [strokeWidth, setStrokeWidth] = useState(0.9);
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
  const [selectedFieldId, setSelectedFieldId] = useState<HandwrittenVisitFieldId>("prescription");
  const [ocrPendingFieldId, setOcrPendingFieldId] = useState<HandwrittenVisitFieldId | null>(null);
  const [ocrAllPending, setOcrAllPending] = useState(false);
  const [capturingPdf, setCapturingPdf] = useState(false);

  const scrollMode = tool === "scroll";

  const registerCheckboxRef = useCallback((checkboxId: HandwrittenVisitCheckboxId, node: HTMLInputElement | null) => {
    checkboxRefs.current[checkboxId] = node;
  }, []);

  const registerRegionCanvasRef = useCallback((fieldId: HandwrittenVisitFieldId, node: HTMLCanvasElement | null) => {
    regionCanvasElementsRef.current[fieldId] = node;
  }, []);

  useEffect(() => {
    editorStateRef.current = editorState;
  }, [editorState]);

  const createSnapshot = useCallback((): EditorSnapshot => cloneSheetState(editorStateRef.current), []);

  const ensureFabricModule = useCallback(async () => {
    if (!fabricModuleRef.current) {
      fabricModuleRef.current = await import("fabric");
    }
    return fabricModuleRef.current;
  }, []);

  const syncWritableCanvases = useCallback(
    async (regions: HandwrittenVisitSheetState["ocrRegions"]) => {
      if (!open) return;
      await ensureFabricModule();
      syncingWritableCanvasesRef.current = true;
      try {
        for (const fieldId of HANDWRITTEN_VISIT_FIELD_IDS) {
          const canvas = regionCanvasesRef.current[fieldId];
          if (!canvas) continue;
          await canvas.loadFromJSON(regions[fieldId]?.fabricJson ?? EMPTY_FABRIC_JSON);
          canvas.requestRenderAll();
        }
      } finally {
        syncingWritableCanvasesRef.current = false;
      }
    },
    [ensureFabricModule, open],
  );

  const applyWritableCanvasSettings = useCallback(async () => {
    if (!open) return;
    const fabric = await ensureFabricModule();
    for (const fieldId of HANDWRITTEN_VISIT_FIELD_IDS) {
      const canvas = regionCanvasesRef.current[fieldId];
      if (!canvas) continue;
      const brush =
        canvas.freeDrawingBrush instanceof fabric.PencilBrush ? canvas.freeDrawingBrush : new fabric.PencilBrush(canvas);
      brush.color = "#111827";
      brush.width = Math.max(0.8, strokeWidth);
      brush.decimate = 0.4;
      canvas.freeDrawingBrush = brush;
      canvas.isDrawingMode = tool === "draw" && editorStateRef.current.ocrRegions[fieldId]?.mode !== "ocr";
      canvas.selection = false;
      canvas.skipTargetFind = true;
      canvas.requestRenderAll();
    }
  }, [ensureFabricModule, open, strokeWidth, tool]);

  const restoreSnapshot = useCallback((snapshot: EditorSnapshot) => {
    const next = cloneSheetState(snapshot);
    editorStateRef.current = next;
    setEditorState(next);
    void syncWritableCanvases(next.ocrRegions);
  }, [syncWritableCanvases]);

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
    if (!open) return;
    let cancelled = false;

    void (async () => {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      if (cancelled) return;
      const fabric = await ensureFabricModule();
      if (cancelled) return;

      for (const fieldId of HANDWRITTEN_VISIT_FIELD_IDS) {
        const node = regionCanvasElementsRef.current[fieldId];
        if (!node || regionCanvasesRef.current[fieldId]) continue;
        const rect = node.parentElement?.getBoundingClientRect() ?? node.getBoundingClientRect();
        const width = Math.max(24, Math.round(rect.width || node.clientWidth || 24));
        const height = Math.max(20, Math.round(rect.height || node.clientHeight || 20));
        const canvas = new fabric.Canvas(node, {
          width,
          height,
          selection: false,
          skipTargetFind: true,
          isDrawingMode: false,
          backgroundColor: "rgba(255,255,255,0)",
        });
        const brush = new fabric.PencilBrush(canvas);
        brush.color = "#111827";
        brush.width = Math.max(0.8, strokeWidth);
        brush.decimate = 0.4;
        canvas.freeDrawingBrush = brush;
        canvas.on("mouse:down", () => {
          setSelectedFieldId(fieldId);
        });
        canvas.on("path:created", () => {
          if (syncingWritableCanvasesRef.current) return;
          pushUndoSnapshot();
          const nextCanvas = regionCanvasesRef.current[fieldId];
          if (!nextCanvas) return;
          const inkBounds = getCanvasInkBounds(nextCanvas);
          setEditorState((prev) => {
            const next = cloneSheetState(prev);
            next.ocrRegions[fieldId] = {
              mode: "ink",
              text: "",
              ocrText: "",
              fabricJson: serializeRegionCanvas(nextCanvas),
              inkBounds,
              textBox: null,
              fontSize: null,
            };
            editorStateRef.current = next;
            return next;
          });
        });
        regionCanvasesRef.current[fieldId] = canvas;
      }

      await syncWritableCanvases(editorStateRef.current.ocrRegions);
      await applyWritableCanvasSettings();
    })();

    return () => {
      cancelled = true;
      for (const fieldId of HANDWRITTEN_VISIT_FIELD_IDS) {
        regionCanvasesRef.current[fieldId]?.dispose();
      }
      regionCanvasesRef.current = {};
    };
  }, [applyWritableCanvasSettings, ensureFabricModule, open, pushUndoSnapshot, strokeWidth, syncWritableCanvases]);

  useEffect(() => {
    void applyWritableCanvasSettings();
  }, [applyWritableCanvasSettings]);

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

  const startStroke = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (tool !== "highlight") return;
    const point = getStagePoint(event);

    const stroke: StrokeLike = {
      id: crypto.randomUUID(),
      width: Math.max(10, strokeWidth * 4),
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
  }, [getStagePoint, strokeWidth, tool]);

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

    pushUndoSnapshot();
    setEditorState((prev) => ({
      ...prev,
      highlights: [...prev.highlights, cloneStroke(stroke)],
    }));
  }, [pushUndoSnapshot]);

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
    for (const fieldId of HANDWRITTEN_VISIT_FIELD_IDS) {
      const canvas = regionCanvasesRef.current[fieldId];
      if (!canvas) continue;
      canvas.remove(...canvas.getObjects());
      canvas.requestRenderAll();
    }
    setEditorState((prev) => ({
      ...prev,
      highlights: [],
      inkFallbacks: [],
      ocrRegions: HANDWRITTEN_VISIT_FIELD_IDS.reduce(
        (acc, fieldId) => {
          acc[fieldId] = createEmptyWritableRegionState();
          return acc;
        },
        {} as HandwrittenVisitSheetState["ocrRegions"],
      ),
    }));
  }, [pushUndoSnapshot]);

  const clearWritableRegion = useCallback((fieldId: HandwrittenVisitFieldId) => {
    const canvas = regionCanvasesRef.current[fieldId];
    pushUndoSnapshot();
    if (canvas) {
      canvas.remove(...canvas.getObjects());
      canvas.requestRenderAll();
    }
    setEditorState((prev) => {
      const next = cloneSheetState(prev);
      next.ocrRegions[fieldId] = createEmptyWritableRegionState();
      editorStateRef.current = next;
      return next;
    });
    textEditSnapshotFieldRef.current = null;
  }, [pushUndoSnapshot]);

  const recognizeSingleWritableRegion = useCallback(async (fieldId: HandwrittenVisitFieldId) => {
    const canvas = regionCanvasesRef.current[fieldId];
    if (!canvas || !canvasHasObjects(canvas)) {
      setError(`Add handwriting inside ${WRITABLE_REGION_LABELS[fieldId]} before running OCR.`);
      return;
    }

    const inkBounds = getCanvasInkBounds(canvas);
    if (!inkBounds) {
      setError(`Add handwriting inside ${WRITABLE_REGION_LABELS[fieldId]} before running OCR.`);
      return;
    }

    setOcrPendingFieldId(fieldId);
    setMessage(null);
    setError(null);

    try {
      const singleLine = canvas.getHeight() <= 52;
      const imageDataUrl = exportRegionCanvasImage(canvas, inkBounds);
      const ocrPayload = await prepareHandwrittenRegionOcrPayload(imageDataUrl, { singleLine });
      const result = await recognizeHandwrittenRegionAction({
        visitId,
        fieldId,
        fieldLabel: WRITABLE_REGION_LABELS[fieldId],
        singleLine,
        ...ocrPayload,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const text = result.text;
      if (!text) {
        setError(`OCR could not read ${WRITABLE_REGION_LABELS[fieldId]}. Try writing darker or more clearly.`);
        return;
      }

      const textBox = getWritableTextBox(inkBounds, canvas.getWidth(), canvas.getHeight());
      const fontSize = getWritableFontSize(textBox, canvas.getHeight());

      pushUndoSnapshot();
      setEditorState((prev) => {
        const next = cloneSheetState(prev);
        next.ocrRegions[fieldId] = {
          mode: "ocr",
          text,
          ocrText: text,
          fabricJson: serializeRegionCanvas(canvas),
          inkBounds,
          textBox,
          fontSize,
        };
        editorStateRef.current = next;
        return next;
      });
      setSelectedFieldId(fieldId);
      setMessage(`${WRITABLE_REGION_LABELS[fieldId]} converted to typed text.`);
    } catch (ocrError) {
      setError(ocrError instanceof Error ? ocrError.message : "Failed to convert handwriting to text.");
    } finally {
      setOcrPendingFieldId(null);
    }
  }, [pushUndoSnapshot, visitId]);

  const recognizeAllWritableRegions = useCallback(async () => {
    const targets = HANDWRITTEN_VISIT_FIELD_IDS.filter((fieldId) => canvasHasObjects(regionCanvasesRef.current[fieldId]));
    if (!targets.length) {
      setError("Add handwriting inside at least one writable region before running OCR.");
      return;
    }

    setOcrAllPending(true);
    setMessage(null);
    setError(null);

    try {
      const nextState = createSnapshot();
      let converted = 0;
      let firstConvertedField: HandwrittenVisitFieldId | null = null;

      for (const fieldId of targets) {
        const canvas = regionCanvasesRef.current[fieldId];
        if (!canvas) continue;
        const inkBounds = getCanvasInkBounds(canvas);
        if (!inkBounds) continue;
        const singleLine = canvas.getHeight() <= 52;
        const imageDataUrl = exportRegionCanvasImage(canvas, inkBounds);
        const ocrPayload = await prepareHandwrittenRegionOcrPayload(imageDataUrl, { singleLine });
        const result = await recognizeHandwrittenRegionAction({
          visitId,
          fieldId,
          fieldLabel: WRITABLE_REGION_LABELS[fieldId],
          singleLine,
          ...ocrPayload,
        });
        if (!result.ok) continue;
        const text = result.text;
        if (!text) continue;
        const textBox = getWritableTextBox(inkBounds, canvas.getWidth(), canvas.getHeight());
        nextState.ocrRegions[fieldId] = {
          mode: "ocr",
          text,
          ocrText: text,
          fabricJson: serializeRegionCanvas(canvas),
          inkBounds,
          textBox,
          fontSize: getWritableFontSize(textBox, canvas.getHeight()),
        };
        converted += 1;
        if (!firstConvertedField) {
          firstConvertedField = fieldId;
        }
      }

      if (!converted) {
        setError("OCR could not read the written regions. Try darker writing or smaller groups of text.");
        return;
      }

      pushUndoSnapshot();
      editorStateRef.current = nextState;
      setEditorState(nextState);
      if (firstConvertedField) {
        setSelectedFieldId(firstConvertedField);
      }
      setMessage(`Converted ${converted} handwritten region${converted === 1 ? "" : "s"} to typed text.`);
    } catch (ocrError) {
      setError(ocrError instanceof Error ? ocrError.message : "Failed to convert handwriting to text.");
    } finally {
      setOcrAllPending(false);
    }
  }, [createSnapshot, pushUndoSnapshot, visitId]);

  const handleSelectedRegionTextFocus = useCallback(() => {
    if (!selectedFieldId) return;
    if (textEditSnapshotFieldRef.current === selectedFieldId) return;
    pushUndoSnapshot();
    textEditSnapshotFieldRef.current = selectedFieldId;
  }, [pushUndoSnapshot, selectedFieldId]);

  const handleSelectedRegionTextBlur = useCallback(() => {
    textEditSnapshotFieldRef.current = null;
  }, []);

  const handleSelectedRegionTextChange = useCallback((value: string) => {
    setEditorState((prev) => {
      const next = cloneSheetState(prev);
      next.ocrRegions[selectedFieldId] = {
        ...next.ocrRegions[selectedFieldId],
        mode: "ocr",
        text: value,
      };
      editorStateRef.current = next;
      return next;
    });
  }, [selectedFieldId]);

  const handleWritableRegionPointerDown = useCallback((fieldId: HandwrittenVisitFieldId) => {
    setSelectedFieldId(fieldId);
    setMessage(null);
    setError(null);
    if (tool === "erase") {
      clearWritableRegion(fieldId);
    }
  }, [clearWritableRegion, tool]);

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
    setCapturingPdf(true);
    setError(null);
    setMessage(null);

    try {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

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
      setCapturingPdf(false);
    }
  }

  const overlayPointerClass = tool === "highlight" ? "pointer-events-auto touch-none" : "pointer-events-none";
  const renderedStrokes = useMemo(
    () => [
      ...editorState.highlights.map((stroke) => ({ ...stroke, color: "#facc15", opacity: 0.35 })),
      ...editorState.inkFallbacks.map((stroke) => ({ ...stroke, color: "#111827", opacity: 0.9 })),
    ],
    [editorState.highlights, editorState.inkFallbacks],
  );
  const hasWritableContent = useMemo(
    () =>
      HANDWRITTEN_VISIT_FIELD_IDS.some((fieldId) => {
        const region = editorState.ocrRegions[fieldId];
        return Boolean(region.text.trim() || hasSerializedFabricObjects(region.fabricJson));
      }),
    [editorState.ocrRegions],
  );
  const selectedRegion = editorState.ocrRegions[selectedFieldId];
  const selectedRegionHasInk =
    canvasHasObjects(regionCanvasesRef.current[selectedFieldId]) || hasSerializedFabricObjects(selectedRegion?.fabricJson);
  const busyOcr = ocrAllPending || Boolean(ocrPendingFieldId);

  const renderWritableRegion = useCallback(
    (fieldId: HandwrittenVisitFieldId) => {
      const region = editorState.ocrRegions[fieldId];
      const isSelected = selectedFieldId === fieldId;
      const showTypedText = region.mode === "ocr" && region.text.trim().length > 0;
      const textBox = region.textBox ?? {
        x: 2,
        y: 2,
        width: 160,
        height: 28,
      };
      return (
        <div className="absolute inset-0 z-[2]">
          <button
            type="button"
            aria-label={`Select ${WRITABLE_REGION_LABELS[fieldId]}`}
            className={`absolute inset-0 rounded-[4px] ${
              capturingPdf ? "" : isSelected ? "shadow-[inset_0_0_0_1px_rgba(37,99,235,0.75)]" : ""
            }`}
            onPointerDown={() => handleWritableRegionPointerDown(fieldId)}
          />
          <canvas
            ref={(node) => registerRegionCanvasRef(fieldId, node)}
            className={`absolute inset-0 h-full w-full ${
              showTypedText || tool === "highlight" || tool === "scroll" || tool === "erase"
                ? "pointer-events-none"
                : "pointer-events-auto"
            } ${showTypedText ? "opacity-0" : "opacity-100"}`}
          />
          {showTypedText ? (
            <div
              className="pointer-events-none absolute overflow-hidden whitespace-pre-wrap break-words text-left leading-[1.15] text-slate-900"
              style={{
                left: textBox.x,
                top: textBox.y,
                width: textBox.width,
                minHeight: textBox.height,
                fontSize: region.fontSize ?? 12,
              }}
            >
              {region.text}
            </div>
          ) : null}
        </div>
      );
    },
    [capturingPdf, editorState.ocrRegions, handleWritableRegionPointerDown, registerRegionCanvasRef, selectedFieldId, tool],
  );

  const toolbarBody = (
    <>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tools</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" aria-label="Write" title="Write" className={toolButtonClass(tool === "draw")} onClick={() => setTool("draw")}>
            <ToolIcon tool="draw" />
          </button>
          <button type="button" aria-label="Highlight" title="Highlight" className={toolButtonClass(tool === "highlight")} onClick={() => setTool("highlight")}>
            <ToolIcon tool="highlight" />
          </button>
          <button type="button" aria-label="Erase" title="Erase" className={toolButtonClass(tool === "erase")} onClick={() => setTool("erase")}>
            <ToolIcon tool="erase" />
          </button>
          <button type="button" aria-label="Scroll / Edit" title="Scroll / Edit" className={toolButtonClass(tool === "scroll")} onClick={() => setTool("scroll")}>
            <ToolIcon tool="scroll" />
          </button>
        </div>
      </div>

      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Stroke size</span>
        <input
          type="range"
          min={0.5}
          max={6}
          step={0.1}
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
          disabled={!editorState.highlights.length && !editorState.inkFallbacks.length && !hasWritableContent}
          onClick={clearAnnotations}
        >
          Clear ink
        </button>
        <button
          type="button"
          className="btn-secondary btn-compact text-xs"
          disabled={!selectedRegionHasInk || busyOcr}
          onClick={() => void recognizeSingleWritableRegion(selectedFieldId)}
        >
          {ocrPendingFieldId === selectedFieldId ? "OCR…" : "OCR selected"}
        </button>
        <button
          type="button"
          className="btn-secondary btn-compact text-xs"
          disabled={!hasWritableContent || busyOcr}
          onClick={() => void recognizeAllWritableRegions()}
        >
          {ocrAllPending ? "OCR all…" : "OCR all"}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-600">
        <p className="font-semibold text-slate-800">Tips</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Use Write to handwrite inside the dedicated boxes on the template.</li>
          <li>Each writable box has its own Fabric canvas and is exported separately for OCR.</li>
          <li>Use OCR Selected or OCR All to convert handwriting into typed text in the same area.</li>
          <li>Edit OCR mistakes in the panel below before saving the PDF.</li>
          <li>Highlight still works on top of the visit form.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[12px] text-slate-600">
        <p className="font-semibold text-slate-900">Selected region</p>
        <p className="mt-1 text-[13px] font-medium text-slate-800">{WRITABLE_REGION_LABELS[selectedFieldId]}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary btn-compact text-xs"
            disabled={!selectedRegionHasInk || busyOcr}
            onClick={() => void recognizeSingleWritableRegion(selectedFieldId)}
          >
            {ocrPendingFieldId === selectedFieldId ? "Converting..." : "Convert to text"}
          </button>
          <button
            type="button"
            className="btn-secondary btn-compact text-xs"
            disabled={!selectedRegionHasInk && !selectedRegion.text.trim()}
            onClick={() => clearWritableRegion(selectedFieldId)}
          >
            Clear region
          </button>
        </div>
        {selectedRegion.mode === "ocr" ? (
          <label className="mt-3 block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Edit OCR text</span>
            <textarea
              rows={selectedFieldId === "prescription" || selectedFieldId === "physicalExamination" || selectedFieldId === "diagnosis" || selectedFieldId === "otherTests" ? 5 : 3}
              value={selectedRegion.text}
              onFocus={handleSelectedRegionTextFocus}
              onBlur={handleSelectedRegionTextBlur}
              onChange={(event) => handleSelectedRegionTextChange(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none focus:border-primary"
            />
            <p className="mt-2 text-[11px] text-slate-500">
              The typed text stays in the same box and will be saved in the handwritten PDF.
            </p>
          </label>
        ) : (
          <p className="mt-3 text-[11px] text-slate-500">
            Draw inside this region, then convert it to text. The OCR result will replace the strokes visually while keeping their position.
          </p>
        )}
      </div>

      {embed ? <p className="text-[11px] text-slate-500">Embedded visit mode still supports full handwritten save.</p> : null}
    </>
  );

  const fullscreenToolbar = (
    <div
      ref={fullscreenToolbarRef}
      className="absolute left-0 top-0 z-20 w-[136px] will-change-transform rounded-2xl border border-slate-300/80 bg-white/90 p-2 shadow-2xl backdrop-blur"
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
        <button type="button" aria-label="Write" title="Write" className={compactToolButtonClass(tool === "draw")} onClick={() => setTool("draw")}>
          <ToolIcon tool="draw" />
        </button>
        <button type="button" aria-label="Highlight" title="Highlight" className={compactToolButtonClass(tool === "highlight")} onClick={() => setTool("highlight")}>
          <ToolIcon tool="highlight" />
        </button>
        <button type="button" aria-label="Erase" title="Erase" className={compactToolButtonClass(tool === "erase")} onClick={() => setTool("erase")}>
          <ToolIcon tool="erase" />
        </button>
        <button type="button" aria-label="Scroll / Edit" title="Scroll / Edit" className={compactToolButtonClass(tool === "scroll")} onClick={() => setTool("scroll")}>
          <ToolIcon tool="scroll" />
        </button>

        <label className="block rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Size</span>
          <input
            type="range"
            min={0.5}
            max={6}
            step={0.1}
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
          disabled={!editorState.highlights.length && !editorState.inkFallbacks.length && !hasWritableContent}
          onClick={clearAnnotations}
        >
          Clear
        </button>
        <button
          type="button"
          className="w-full rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
          disabled={!selectedRegionHasInk || busyOcr}
          onClick={() => void recognizeSingleWritableRegion(selectedFieldId)}
        >
          {ocrPendingFieldId === selectedFieldId ? "OCR..." : "OCR"}
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
        renderWritableRegion={renderWritableRegion}
        logoUrl={logoUrl ?? null}
      />
      <svg
        viewBox={`0 0 ${HANDWRITTEN_VISIT_SHEET_WIDTH} ${HANDWRITTEN_VISIT_SHEET_HEIGHT}`}
        className={`absolute inset-0 z-10 h-full w-full ${overlayPointerClass}`}
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
              Use Fabric.js writable boxes for handwriting, convert each box to typed text with OCR, fix OCR mistakes,
              and save the final sheet as a PDF.
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
                          ? "Scroll / Edit mode is on. Select a writable region or use the checkboxes directly."
                          : tool === "highlight"
                            ? "Highlight mode writes marker strokes across the whole template."
                            : tool === "erase"
                              ? "Eraser mode clears the writable region you tap."
                              : "Write mode lets you handwrite inside the dedicated writable regions."}
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
