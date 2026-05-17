"use client";

import { toBlob as domToBlob } from "html-to-image";
import type { Canvas as FabricCanvas } from "fabric";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import { saveHandwrittenVisitPdfAction } from "@/app/(portal)/visits/visit-report-actions";
import { VisitHandwrittenHtmlSheet } from "@/components/clinical/visit-handwritten-html-sheet";
import {
  compressHandwrittenOcrPayloadForTransport,
  prepareHandwrittenRegionOcrPayload,
  requestHandwrittenRegionOcr,
} from "@/lib/visits/handwritten-ocr";
import { pickBestVeterinaryOcrCandidate } from "@/lib/visits/veterinary-ocr-vocabulary";
import type {
  HandwrittenVisitCheckboxId,
  HandwrittenVisitFieldId,
  HandwrittenVisitPoint,
  HandwrittenVisitRect,
  HandwrittenVisitSheetState,
  HandwrittenVisitWritableRegionState,
} from "@/lib/visits/handwritten-visit-sheet";
import {
  HANDWRITTEN_VISIT_CHECKBOX_IDS,
  HANDWRITTEN_VISIT_FIELD_IDS,
  HANDWRITTEN_VISIT_SHEET_HEIGHT,
  HANDWRITTEN_VISIT_SHEET_WIDTH,
} from "@/lib/visits/handwritten-visit-sheet";

type InkTool = "draw" | "ocr" | "erase" | "highlight";
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
const MULTILINE_OCR_FIELDS = new Set<HandwrittenVisitFieldId>([
  "ccHp",
  "dewormingText",
  "vaccinationText",
  "otherTests",
  "physicalExamination",
  "diagnosis",
  "prescription",
]);
const OCR_REGION_SHORTCUTS: HandwrittenVisitFieldId[] = [
  "ccHp",
  "rt",
  "rr",
  "hr",
  "crt",
  "allergic",
  "bw",
  "physicalExamination",
  "diagnosis",
  "prescription",
];
const OCR_REGION_SHORTCUT_LABELS: Partial<Record<HandwrittenVisitFieldId, string>> = {
  ccHp: "CC / HP",
  physicalExamination: "Physical exam",
  diagnosis: "Dx",
  prescription: "Rx",
  rt: "RT",
  rr: "RR",
  hr: "HR",
  crt: "CRT",
  allergic: "Allergic",
  bw: "B/W",
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

async function waitForNextPaint(frameCount = 1) {
  await new Promise<void>((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => step(remaining - 1));
    };
    step(frameCount);
  });
}

function buildStaticFabricInkImage(fabricCanvas: FabricCanvas) {
  if (!canvasHasObjects(fabricCanvas)) return null;
  const image = document.createElement("img");
  image.alt = "";
  image.className = "pointer-events-none absolute inset-0 h-full w-full";
  image.style.objectFit = "fill";
  try {
    const bounds = getCanvasInkBounds(fabricCanvas);
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      image.src = exportRegionCanvasImage(fabricCanvas, bounds);
    } else {
      image.src = (
        fabricCanvas as unknown as {
          toDataURL: (options: { format: string; multiplier?: number }) => string;
        }
      ).toDataURL({ format: "png", multiplier: 2 });
    }
    return image;
  } catch {
    return null;
  }
}

function applyEditorStateToCaptureClone(clone: HTMLElement, state: HandwrittenVisitSheetState) {
  for (const checkboxId of HANDWRITTEN_VISIT_CHECKBOX_IDS) {
    const input = clone.querySelector<HTMLInputElement>(`input[data-checkbox-id="${checkboxId}"]`);
    if (input) input.checked = Boolean(state.checkboxes[checkboxId]);
  }

  for (const fieldId of HANDWRITTEN_VISIT_FIELD_IDS) {
    const fieldRoot = clone.querySelector<HTMLElement>(`[data-writable-field="${fieldId}"]`);
    if (!fieldRoot) continue;
    const valueNode = fieldRoot.querySelector(".field-value");
    const regionText = state.ocrRegions[fieldId]?.text?.trim() ?? "";
    const tokenText = state.wordTokens
      .filter((token) => token.fieldId === fieldId)
      .map((token) => token.text.trim())
      .filter(Boolean)
      .join("\n");
    const value = [state.fields[fieldId]?.trim(), regionText, tokenText].filter(Boolean).join("\n");
    if (valueNode) {
      valueNode.textContent = value;
    } else if (value) {
      const span = document.createElement("span");
      span.className = "field-value";
      span.textContent = value;
      fieldRoot.insertBefore(span, fieldRoot.firstChild);
    }
  }
}

function styleFabricCanvasContainer(canvasNode: HTMLCanvasElement | null | undefined, layerZIndex: number) {
  const container = canvasNode?.closest(".canvas-container") as HTMLElement | null;
  if (!container) return;
  container.style.position = "absolute";
  container.style.inset = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.zIndex = String(layerZIndex);
}

function setCanvasContainerPointerEvents(canvasNode: HTMLCanvasElement | null | undefined, enabled: boolean) {
  const container = canvasNode?.closest(".canvas-container") as HTMLElement | null;
  if (!container) return;
  container.style.pointerEvents = enabled ? "auto" : "none";
  const upper = container.querySelector(".upper-canvas") as HTMLElement | null;
  const lower = container.querySelector(".lower-canvas") as HTMLElement | null;
  if (upper) upper.style.pointerEvents = enabled ? "auto" : "none";
  if (lower) lower.style.pointerEvents = enabled ? "auto" : "none";
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
  if (tool === "ocr") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2.2" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2.5" />
        <path d="M8 9h3" />
        <path d="M8 15h8" />
        <path d="M12 9l2.5 6" />
        <path d="M17 8v8" />
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
    ocrFabricJson: null,
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

function isSingleLineOcrField(fieldId: HandwrittenVisitFieldId) {
  return !MULTILINE_OCR_FIELDS.has(fieldId);
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
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  const left = Math.max(0, Math.round(bounds.x));
  const top = Math.max(0, Math.round(bounds.y));
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
    left,
    top,
    width,
    height,
    multiplier: 4,
  });
}

function shouldCompactHandwriting(fieldId: HandwrittenVisitFieldId) {
  return fieldId === "diagnosis" || fieldId === "prescription";
}

function compactLatestHandwrittenObject(fieldId: HandwrittenVisitFieldId, canvas: FabricCanvas) {
  if (!shouldCompactHandwriting(fieldId)) return;
  const objects = canvas.getObjects();
  const latestObject = objects[objects.length - 1] as
    | (Partial<{
        scaleX: number;
        scaleY: number;
        left: number;
        top: number;
        setCoords: () => void;
        getBoundingRect: (
          absolute?: boolean,
          calculate?: boolean,
        ) => { left: number; top: number; width: number; height: number };
      }> & {
        getBoundingRect?: (
          absolute?: boolean,
          calculate?: boolean,
        ) => { left: number; top: number; width: number; height: number };
      })
    | undefined;
  if (!latestObject?.getBoundingRect) return;

  const initialRect = latestObject.getBoundingRect(true, true);
  if (!initialRect.width || !initialRect.height) return;

  const targetHeight = fieldId === "prescription" ? 18 : 20;
  const maxWidth = canvas.getWidth() - 18;
  const scaleFactor = Math.min(1, targetHeight / initialRect.height, maxWidth / initialRect.width);
  if (!Number.isFinite(scaleFactor) || scaleFactor >= 0.999) return;

  latestObject.scaleX = (latestObject.scaleX ?? 1) * scaleFactor;
  latestObject.scaleY = (latestObject.scaleY ?? 1) * scaleFactor;
  latestObject.setCoords?.();

  const scaledRect = latestObject.getBoundingRect(true, true);
  latestObject.left = (latestObject.left ?? 0) + (initialRect.left - scaledRect.left);
  latestObject.top = (latestObject.top ?? 0) + (initialRect.top - scaledRect.top);
  latestObject.setCoords?.();

  const alignedRect = latestObject.getBoundingRect(true, true);
  if (alignedRect.left < 4) {
    latestObject.left = (latestObject.left ?? 0) + (4 - alignedRect.left);
  }
  if (alignedRect.top < 4) {
    latestObject.top = (latestObject.top ?? 0) + (4 - alignedRect.top);
  }
  latestObject.setCoords?.();
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
  inkOnly = false,
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
  /** When true, drawing-only digital sheet — no OCR layer (use Photo sheet tab for scanned notes). */
  inkOnly?: boolean;
}) {
  const enableOcr = !inkOnly;
  const router = useRouter();
  const studioRef = useRef<HTMLDivElement | null>(null);
  const fullscreenToolbarRef = useRef<HTMLDivElement | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const checkboxRefs = useRef<Partial<Record<HandwrittenVisitCheckboxId, HTMLInputElement | null>>>({});
  const drawCanvasElementsRef = useRef<Partial<Record<HandwrittenVisitFieldId, HTMLCanvasElement | null>>>({});
  const ocrCanvasElementsRef = useRef<Partial<Record<HandwrittenVisitFieldId, HTMLCanvasElement | null>>>({});
  const drawCanvasesRef = useRef<RegionCanvasMap>({});
  const ocrCanvasesRef = useRef<RegionCanvasMap>({});
  const ocrIdleTimersRef = useRef<Partial<Record<HandwrittenVisitFieldId, number>>>({});
  const fabricModuleRef = useRef<typeof import("fabric") | null>(null);
  const syncingWritableCanvasesRef = useRef(false);
  const editorStateRef = useRef<HandwrittenVisitSheetState>(cloneSheetState(initialState));
  const textEditSnapshotFieldRef = useRef<HandwrittenVisitFieldId | null>(null);
  const textEditSnapshotTokenRef = useRef<string | null>(null);
  const convertPendingOcrRegionRef = useRef<(fieldId: HandwrittenVisitFieldId) => void>(() => undefined);
  const activePointerId = useRef<number | null>(null);
  const activeStrokeRef = useRef<StrokeLike | null>(null);
  const toolbarDragPointerId = useRef<number | null>(null);
  const toolbarDragOffset = useRef<HandwrittenVisitPoint | null>(null);
  const fullscreenToolbarPosRef = useRef<ToolbarPosition>(TOOLBAR_DEFAULT_POS);
  const pendingToolbarPosRef = useRef<ToolbarPosition | null>(null);
  const toolbarDragRafRef = useRef<number | null>(null);

  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<Tool>("scroll");
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
  const [capturingPdf, setCapturingPdf] = useState(false);
  const [zoom, setZoom] = useState(1);

  const scrollMode = tool === "scroll";

  const registerCheckboxRef = useCallback((checkboxId: HandwrittenVisitCheckboxId, node: HTMLInputElement | null) => {
    checkboxRefs.current[checkboxId] = node;
  }, []);

  const registerDrawCanvasRef = useCallback((fieldId: HandwrittenVisitFieldId, node: HTMLCanvasElement | null) => {
    drawCanvasElementsRef.current[fieldId] = node;
  }, []);

  const registerOcrCanvasRef = useCallback((fieldId: HandwrittenVisitFieldId, node: HTMLCanvasElement | null) => {
    ocrCanvasElementsRef.current[fieldId] = node;
  }, []);

  useEffect(() => {
    editorStateRef.current = editorState;
  }, [editorState]);

  const createSnapshot = useCallback((): EditorSnapshot => cloneSheetState(editorStateRef.current), []);

  const clearOcrIdleTimer = useCallback((fieldId: HandwrittenVisitFieldId) => {
    const timer = ocrIdleTimersRef.current[fieldId];
    if (timer) {
      window.clearTimeout(timer);
      delete ocrIdleTimersRef.current[fieldId];
    }
  }, []);

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
          const drawCanvas = drawCanvasesRef.current[fieldId];
          const ocrCanvas = ocrCanvasesRef.current[fieldId];
          if (drawCanvas) {
            await drawCanvas.loadFromJSON(regions[fieldId]?.fabricJson ?? EMPTY_FABRIC_JSON);
            drawCanvas.requestRenderAll();
          }
          if (ocrCanvas) {
            await ocrCanvas.loadFromJSON(regions[fieldId]?.ocrFabricJson ?? EMPTY_FABRIC_JSON);
            ocrCanvas.requestRenderAll();
          }
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
      const drawCanvas = drawCanvasesRef.current[fieldId];
      const ocrCanvas = ocrCanvasesRef.current[fieldId];
      if (drawCanvas) {
        const drawBrush =
          drawCanvas.freeDrawingBrush instanceof fabric.PencilBrush
            ? drawCanvas.freeDrawingBrush
            : new fabric.PencilBrush(drawCanvas);
        drawBrush.color = "#111827";
        drawBrush.width = Math.max(0.8, strokeWidth);
        drawBrush.decimate = 0.4;
        drawCanvas.freeDrawingBrush = drawBrush;
        drawCanvas.isDrawingMode = tool === "draw";
        drawCanvas.selection = false;
        drawCanvas.skipTargetFind = true;
        drawCanvas.requestRenderAll();
        styleFabricCanvasContainer(drawCanvasElementsRef.current[fieldId], 5);
        setCanvasContainerPointerEvents(drawCanvasElementsRef.current[fieldId], tool === "draw");
      }
      if (enableOcr && ocrCanvas) {
        const ocrBrush =
          ocrCanvas.freeDrawingBrush instanceof fabric.PencilBrush
            ? ocrCanvas.freeDrawingBrush
            : new fabric.PencilBrush(ocrCanvas);
        ocrBrush.color = "#111827";
        ocrBrush.width = Math.max(0.8, strokeWidth);
        ocrBrush.decimate = 0.05;
        ocrCanvas.freeDrawingBrush = ocrBrush;
        ocrCanvas.isDrawingMode = tool === "ocr";
        ocrCanvas.selection = false;
        ocrCanvas.skipTargetFind = true;
        ocrCanvas.requestRenderAll();
        styleFabricCanvasContainer(ocrCanvasElementsRef.current[fieldId], 6);
        setCanvasContainerPointerEvents(ocrCanvasElementsRef.current[fieldId], tool === "ocr");
      }
    }
  }, [enableOcr, ensureFabricModule, open, strokeWidth, tool]);

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
    if (open) {
      setTool("scroll");
    }
  }, [open]);

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
        const drawNode = drawCanvasElementsRef.current[fieldId];
        const ocrNode = ocrCanvasElementsRef.current[fieldId];
        if ((!drawNode && !ocrNode) || (drawCanvasesRef.current[fieldId] && ocrCanvasesRef.current[fieldId])) continue;
        const measureNode = drawNode ?? ocrNode;
        if (!measureNode) continue;
        const rect = measureNode.parentElement?.getBoundingClientRect() ?? measureNode.getBoundingClientRect();
        const width = Math.max(24, Math.round(rect.width || measureNode.clientWidth || 24));
        const height = Math.max(20, Math.round(rect.height || measureNode.clientHeight || 20));
        if (drawNode && !drawCanvasesRef.current[fieldId]) {
          const drawCanvas = new fabric.Canvas(drawNode, {
            width,
            height,
            selection: false,
            skipTargetFind: true,
            isDrawingMode: false,
            backgroundColor: "rgba(255,255,255,0)",
          });
          const drawBrush = new fabric.PencilBrush(drawCanvas);
          drawBrush.color = "#111827";
          drawBrush.width = Math.max(0.8, strokeWidth);
          drawBrush.decimate = 0.4;
          drawCanvas.freeDrawingBrush = drawBrush;
          drawCanvas.on("mouse:down", () => {
            setSelectedFieldId(fieldId);
          });
          drawCanvas.on("path:created", () => {
            if (syncingWritableCanvasesRef.current) return;
            pushUndoSnapshot();
            const nextCanvas = drawCanvasesRef.current[fieldId];
            if (!nextCanvas) return;
            compactLatestHandwrittenObject(fieldId, nextCanvas);
            const inkBounds = getCanvasInkBounds(nextCanvas);
            setEditorState((prev) => {
              const next = cloneSheetState(prev);
              next.ocrRegions[fieldId] = {
                ...next.ocrRegions[fieldId],
                mode: "ink",
                fabricJson: serializeRegionCanvas(nextCanvas),
                inkBounds,
              };
              editorStateRef.current = next;
              return next;
            });
          });
          drawCanvasesRef.current[fieldId] = drawCanvas;
          styleFabricCanvasContainer(drawNode, 5);
        }
        if (enableOcr && ocrNode && !ocrCanvasesRef.current[fieldId]) {
          const ocrCanvas = new fabric.Canvas(ocrNode, {
            width,
            height,
            selection: false,
            skipTargetFind: true,
            isDrawingMode: false,
            backgroundColor: "rgba(255,255,255,0)",
          });
          const ocrBrush = new fabric.PencilBrush(ocrCanvas);
          ocrBrush.color = "#111827";
          ocrBrush.width = Math.max(0.8, strokeWidth);
          ocrBrush.decimate = 0.05;
          ocrCanvas.freeDrawingBrush = ocrBrush;
          ocrCanvas.on("mouse:down", () => {
            setSelectedFieldId(fieldId);
            clearOcrIdleTimer(fieldId);
          });
          ocrCanvas.on("path:created", () => {
            if (syncingWritableCanvasesRef.current) return;
            pushUndoSnapshot();
            const nextCanvas = ocrCanvasesRef.current[fieldId];
            if (!nextCanvas) return;
            setEditorState((prev) => {
              const next = cloneSheetState(prev);
              next.ocrRegions[fieldId] = {
                ...next.ocrRegions[fieldId],
                mode: "ocr",
                ocrFabricJson: serializeRegionCanvas(nextCanvas),
              };
              editorStateRef.current = next;
              return next;
            });
            clearOcrIdleTimer(fieldId);
            ocrIdleTimersRef.current[fieldId] = window.setTimeout(() => {
              convertPendingOcrRegionRef.current(fieldId);
            }, 2000);
          });
          ocrCanvasesRef.current[fieldId] = ocrCanvas;
          styleFabricCanvasContainer(ocrNode, 6);
        }
      }

      await syncWritableCanvases(editorStateRef.current.ocrRegions);
      await applyWritableCanvasSettings();
    })();

    return () => {
      cancelled = true;
      for (const fieldId of HANDWRITTEN_VISIT_FIELD_IDS) {
        clearOcrIdleTimer(fieldId);
        drawCanvasesRef.current[fieldId]?.dispose();
        ocrCanvasesRef.current[fieldId]?.dispose();
      }
      drawCanvasesRef.current = {};
      ocrCanvasesRef.current = {};
    };
  }, [applyWritableCanvasSettings, clearOcrIdleTimer, enableOcr, ensureFabricModule, open, pushUndoSnapshot, strokeWidth, syncWritableCanvases]);

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
    textEditSnapshotFieldRef.current = null;
    textEditSnapshotTokenRef.current = null;
    for (const fieldId of HANDWRITTEN_VISIT_FIELD_IDS) {
      clearOcrIdleTimer(fieldId);
      const drawCanvas = drawCanvasesRef.current[fieldId];
      const ocrCanvas = ocrCanvasesRef.current[fieldId];
      if (drawCanvas) {
        drawCanvas.remove(...drawCanvas.getObjects());
        drawCanvas.requestRenderAll();
      }
      if (ocrCanvas) {
        ocrCanvas.remove(...ocrCanvas.getObjects());
        ocrCanvas.requestRenderAll();
      }
    }
    setEditorState((prev) => {
      const next = {
        ...prev,
        highlights: [],
        inkFallbacks: [],
        wordTokens: [],
        ocrRegions: HANDWRITTEN_VISIT_FIELD_IDS.reduce(
          (acc, fieldId) => {
            acc[fieldId] = createEmptyWritableRegionState();
            return acc;
          },
          {} as HandwrittenVisitSheetState["ocrRegions"],
        ),
      };
      editorStateRef.current = next;
      return next;
    });
  }, [clearOcrIdleTimer, pushUndoSnapshot]);

  const clearWritableRegion = useCallback((fieldId: HandwrittenVisitFieldId) => {
    const drawCanvas = drawCanvasesRef.current[fieldId];
    const ocrCanvas = ocrCanvasesRef.current[fieldId];
    pushUndoSnapshot();
    clearOcrIdleTimer(fieldId);
    if (drawCanvas) {
      drawCanvas.remove(...drawCanvas.getObjects());
      drawCanvas.requestRenderAll();
    }
    if (ocrCanvas) {
      ocrCanvas.remove(...ocrCanvas.getObjects());
      ocrCanvas.requestRenderAll();
    }
    setEditorState((prev) => {
      const next = cloneSheetState(prev);
      next.ocrRegions[fieldId] = createEmptyWritableRegionState();
      next.wordTokens = next.wordTokens.filter((token) => token.fieldId !== fieldId);
      editorStateRef.current = next;
      return next;
    });
    textEditSnapshotFieldRef.current = null;
    textEditSnapshotTokenRef.current = null;
  }, [clearOcrIdleTimer, pushUndoSnapshot]);

  const recognizePendingOcrRegion = useCallback(async (fieldId: HandwrittenVisitFieldId) => {
    const canvas = ocrCanvasesRef.current[fieldId];
    if (!canvas || !canvasHasObjects(canvas)) {
      return;
    }

    const inkBounds = getCanvasInkBounds(canvas);
    if (!inkBounds) {
      return;
    }

    clearOcrIdleTimer(fieldId);
    setOcrPendingFieldId(fieldId);
    setSelectedFieldId(fieldId);
    setMessage(null);
    setError(null);

    try {
      const singleLine = isSingleLineOcrField(fieldId);
      const imageDataUrl = exportRegionCanvasImage(canvas, inkBounds);
      const ocrPayload = await prepareHandwrittenRegionOcrPayload(imageDataUrl, { singleLine });
      const transportPayload = await compressHandwrittenOcrPayloadForTransport(ocrPayload);
      const result = await requestHandwrittenRegionOcr({
        visitId,
        fieldId,
        fieldLabel: WRITABLE_REGION_LABELS[fieldId],
        singleLine,
        rawDataUrl: transportPayload.rawDataUrl,
        contrastDataUrl: transportPayload.contrastDataUrl,
        boostedDataUrl: transportPayload.boostedDataUrl,
        thinStrokeDataUrl: transportPayload.thinStrokeDataUrl,
        localCandidates: transportPayload.localCandidates,
      });
      if (!result?.ok || !result.text.trim()) {
        setError(result?.ok === false ? result.error : `OCR could not read ${WRITABLE_REGION_LABELS[fieldId]}.`);
        return;
      }

      const recognizedText = pickBestVeterinaryOcrCandidate(fieldId, [
        result.text.trim(),
        ...(transportPayload.localCandidates ?? []),
      ]);
      const textBox = getWritableTextBox(inkBounds, canvas.getWidth(), canvas.getHeight());
      const fontSize = Math.max(10, getWritableFontSize(textBox, canvas.getHeight()) * 0.92);
      const nextTokenId = crypto.randomUUID();

      pushUndoSnapshot();
      setEditorState((prev) => {
        const next = cloneSheetState(prev);
        next.wordTokens = [
          ...next.wordTokens,
          {
            id: nextTokenId,
            fieldId,
            text: recognizedText,
            x: textBox.x,
            y: textBox.y,
            width: textBox.width,
            height: textBox.height,
            fontSize,
          },
        ];
        next.ocrRegions[fieldId] = {
          ...next.ocrRegions[fieldId],
          mode: "ocr",
          text: recognizedText,
          ocrText: recognizedText,
          ocrFabricJson: null,
        };
        editorStateRef.current = next;
        return next;
      });

      canvas.remove(...canvas.getObjects());
      canvas.requestRenderAll();
      setMessage(`${WRITABLE_REGION_LABELS[fieldId]} converted to typed text.`);
    } catch (ocrError) {
      setError(ocrError instanceof Error ? ocrError.message : "Failed to convert handwriting to text.");
    } finally {
      setOcrPendingFieldId(null);
      void applyWritableCanvasSettings();
    }
  }, [applyWritableCanvasSettings, clearOcrIdleTimer, pushUndoSnapshot, visitId]);

  useEffect(() => {
    convertPendingOcrRegionRef.current = (fieldId: HandwrittenVisitFieldId) => {
      void recognizePendingOcrRegion(fieldId);
    };
  }, [recognizePendingOcrRegion]);

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

  const handleSelectedTokenFocus = useCallback((tokenId: string) => {
    if (textEditSnapshotTokenRef.current === tokenId) return;
    pushUndoSnapshot();
    textEditSnapshotTokenRef.current = tokenId;
  }, [pushUndoSnapshot]);

  const handleSelectedTokenBlur = useCallback(() => {
    textEditSnapshotTokenRef.current = null;
  }, []);

  const handleSelectedTokenTextChange = useCallback((tokenId: string, value: string) => {
    setEditorState((prev) => {
      const next = cloneSheetState(prev);
      next.wordTokens = next.wordTokens.map((token) => (token.id === tokenId ? { ...token, text: value } : token));
      editorStateRef.current = next;
      return next;
    });
  }, []);

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
    setError(null);
    setMessage(null);
    flushSync(() => {
      setCapturingPdf(true);
    });

    try {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const flushed = cloneSheetState(editorStateRef.current);
      for (const fieldId of HANDWRITTEN_VISIT_FIELD_IDS) {
        const region = flushed.ocrRegions[fieldId];
        if (!region) continue;
        const drawCanvas = drawCanvasesRef.current[fieldId];
        const ocrCanvas = ocrCanvasesRef.current[fieldId];
        try {
          if (drawCanvas && canvasHasObjects(drawCanvas)) {
            flushed.ocrRegions[fieldId] = {
              ...region,
              mode: "ink",
              fabricJson: serializeRegionCanvas(drawCanvas),
              inkBounds: getCanvasInkBounds(drawCanvas) ?? region.inkBounds,
            };
          }
          if (enableOcr && ocrCanvas && canvasHasObjects(ocrCanvas)) {
            const updated = flushed.ocrRegions[fieldId];
            if (updated) {
              flushed.ocrRegions[fieldId] = {
                ...updated,
                mode: (updated.text ?? "").trim() ? updated.mode : "ocr",
                ocrFabricJson: serializeRegionCanvas(ocrCanvas),
              };
            }
          }
        } catch {
          // Keep going — one bad region must not block the whole PDF.
        }
      }
      editorStateRef.current = flushed;

      await waitForNextPaint(2);

      const captureNode = buildStaticPdfCapture();
      if (!captureNode) {
        throw new Error("Failed to prepare the handwritten visit sheet for PDF export.");
      }

      let imageBlob: Blob | null = null;
      try {
        await waitForImages(captureNode);
        imageBlob = await domToBlob(captureNode, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: "#ffffff",
          skipFonts: true,
          filter: (node) => {
            const tag = node.tagName?.toUpperCase?.() ?? "";
            return tag !== "SCRIPT" && tag !== "STYLE";
          },
        });
      } catch (captureError) {
        captureNode.remove();
        throw captureError;
      } finally {
        if (captureNode.isConnected) {
          captureNode.remove();
        }
      }
      if (!imageBlob) throw new Error("Failed to capture the handwritten visit sheet.");

      const fd = new FormData();
      fd.set("visit_id", visitId);
      fd.set("editor_state_json", JSON.stringify(editorStateRef.current));
      fd.set("image_file", new File([imageBlob], `visit-${visitId}.jpg`, { type: EXPORT_MIME }));

      const result = await saveHandwrittenVisitPdfAction(fd);
      if (!result?.ok) {
        setError(result?.error ?? "Failed to save handwritten visit PDF.");
        return;
      }

      setMessage("Handwritten visit PDF saved.");
      router.refresh();
      setOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save the visit PDF.");
    } finally {
      setPending(false);
      setCapturingPdf(false);
    }
  }

  const overlayPointerClass =
    tool === "highlight" ? "pointer-events-auto touch-none z-[4]" : "pointer-events-none z-[4]";
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
        return Boolean(
          region.text.trim() ||
            hasSerializedFabricObjects(region.fabricJson) ||
            hasSerializedFabricObjects(region.ocrFabricJson) ||
            editorState.wordTokens.some((token) => token.fieldId === fieldId),
        );
      }),
    [editorState.ocrRegions, editorState.wordTokens],
  );
  const selectedRegion = editorState.ocrRegions[selectedFieldId];
  const selectedRegionTokens = useMemo(
    () =>
      editorState.wordTokens
        .filter((token) => token.fieldId === selectedFieldId)
        .sort((a, b) => a.y - b.y || a.x - b.x),
    [editorState.wordTokens, selectedFieldId],
  );
  const selectedRegionHasInk =
    canvasHasObjects(drawCanvasesRef.current[selectedFieldId]) ||
    canvasHasObjects(ocrCanvasesRef.current[selectedFieldId]) ||
    hasSerializedFabricObjects(selectedRegion?.fabricJson) ||
    hasSerializedFabricObjects(selectedRegion?.ocrFabricJson) ||
    Boolean(selectedRegion?.text.trim()) ||
    selectedRegionTokens.length > 0;
  const selectedRegionHasPendingOcrInk =
    canvasHasObjects(ocrCanvasesRef.current[selectedFieldId]) || hasSerializedFabricObjects(selectedRegion?.ocrFabricJson);

  const buildStaticPdfCapture = useCallback(() => {
    const root = captureRef.current;
    if (!root) return null;

    const clone = root.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.left = "-10000px";
    clone.style.top = "0";
    clone.style.zIndex = "-1";
    clone.style.pointerEvents = "none";
    clone.style.margin = "0";

    applyEditorStateToCaptureClone(clone, editorStateRef.current);

    clone.querySelectorAll(".canvas-container").forEach((node) => node.remove());
    clone
      .querySelectorAll<HTMLCanvasElement>('canvas[data-canvas-layer="draw"], canvas[data-canvas-layer="ocr"]')
      .forEach((node) => node.remove());

    for (const fieldId of HANDWRITTEN_VISIT_FIELD_IDS) {
      const overlay = clone.querySelector<HTMLElement>(`[data-writable-overlay="${fieldId}"]`);
      if (!overlay) continue;

      const drawFabric = drawCanvasesRef.current[fieldId];
      const drawInk = drawFabric ? buildStaticFabricInkImage(drawFabric) : null;
      if (drawInk) overlay.appendChild(drawInk);

      const ocrFabric = enableOcr ? ocrCanvasesRef.current[fieldId] : null;
      const ocrInk = ocrFabric ? buildStaticFabricInkImage(ocrFabric) : null;
      if (ocrInk) overlay.appendChild(ocrInk);
    }

    document.body.appendChild(clone);
    return clone;
  }, [enableOcr]);

  const renderWritableRegion = useCallback(
    (fieldId: HandwrittenVisitFieldId) => {
      const region = editorState.ocrRegions[fieldId];
      const isSelected = selectedFieldId === fieldId;
      const showOcrGuide = enableOcr && tool === "ocr" && !capturingPdf;
      const tokens = editorState.wordTokens
        .filter((token) => token.fieldId === fieldId)
        .sort((a, b) => a.y - b.y || a.x - b.x);
      return (
        <div data-writable-overlay={fieldId} className="absolute inset-0 z-[2]">
          {!capturingPdf ? (
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-0 z-[1] rounded-[4px] ${
                isSelected
                  ? "bg-primary/[0.06] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.35)]"
                  : showOcrGuide
                    ? "bg-sky-400/[0.05] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]"
                    : ""
              }`}
            />
          ) : null}
          <canvas
            ref={(node) => registerDrawCanvasRef(fieldId, node)}
            data-canvas-layer="draw"
            data-field-id={fieldId}
            className={`absolute inset-0 z-[5] h-full w-full ${
              tool === "draw" ? "pointer-events-auto touch-none" : "pointer-events-none"
            }`}
          />
          {enableOcr ? (
            <canvas
              ref={(node) => registerOcrCanvasRef(fieldId, node)}
              data-canvas-layer="ocr"
              data-field-id={fieldId}
              className={`absolute inset-0 z-[6] h-full w-full ${
                tool === "ocr" ? "pointer-events-auto touch-none" : "pointer-events-none"
              }`}
            />
          ) : null}
          {tool === "erase" || tool === "scroll" ? (
            <button
              type="button"
              aria-label={`Select ${WRITABLE_REGION_LABELS[fieldId]}`}
              className="pointer-events-auto absolute inset-0 rounded-[4px]"
              onPointerDown={() => handleWritableRegionPointerDown(fieldId)}
            />
          ) : null}
          {region.text.trim() && region.textBox ? (
            <div
              className="pointer-events-none absolute overflow-hidden whitespace-pre-wrap break-words text-left leading-[1.15] text-slate-900"
              style={{
                left: region.textBox.x,
                top: region.textBox.y,
                width: region.textBox.width,
                minHeight: region.textBox.height,
                fontSize: region.fontSize ?? 12,
              }}
            >
              {region.text}
            </div>
          ) : null}
          {tokens.map((token) => (
            <div
              key={token.id}
              className="pointer-events-none absolute overflow-hidden whitespace-pre-wrap break-words text-left leading-[1.15] text-slate-900"
              style={{
                left: token.x,
                top: token.y,
                width: token.width,
                minHeight: token.height,
                fontSize: token.fontSize,
              }}
            >
              {token.text}
            </div>
          ))}
        </div>
      );
    },
    [
      capturingPdf,
      editorState.ocrRegions,
      editorState.wordTokens,
      handleWritableRegionPointerDown,
      registerDrawCanvasRef,
      registerOcrCanvasRef,
      enableOcr,
      selectedFieldId,
      tool,
    ],
  );

  const toolbarBody = (
    <>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tools</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" aria-label="Normal write" title="Normal write" className={toolButtonClass(tool === "draw")} onClick={() => setTool("draw")}>
            <ToolIcon tool="draw" />
          </button>
          {enableOcr ? (
            <button type="button" aria-label="OCR write" title="OCR write" className={toolButtonClass(tool === "ocr")} onClick={() => setTool("ocr")}>
              <ToolIcon tool="ocr" />
            </button>
          ) : null}
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

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Zoom</span>
          <span className="text-[11px] font-semibold text-slate-700">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="btn-secondary btn-compact flex-1 text-xs"
            disabled={zoom <= 0.6}
            onClick={() => setZoom((current) => Math.max(0.6, Number((current - 0.1).toFixed(2))))}
          >
            Zoom out
          </button>
          <button type="button" className="btn-secondary btn-compact flex-1 text-xs" onClick={() => setZoom(1)}>
            100%
          </button>
          <button
            type="button"
            className="btn-secondary btn-compact flex-1 text-xs"
            disabled={zoom >= 2}
            onClick={() => setZoom((current) => Math.min(2, Number((current + 0.1).toFixed(2))))}
          >
            Zoom in
          </button>
        </div>
      </div>

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
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-600">
        <p className="font-semibold text-slate-800">Tips</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {inkOnly ? (
            <>
              <li>Draw on the clinic template; ink is saved in the visit PDF.</li>
              <li>For paper notes from a phone camera, use the Photo sheet tab.</li>
              <li>`Scroll / Edit` lets you move around the sheet and use the checkboxes safely.</li>
            </>
          ) : (
            <>
              <li>`Normal write` keeps your handwriting exactly as ink and never sends it for OCR.</li>
              <li>`OCR write` watches only the OCR layer. About 2 seconds after you stop writing, that stroke group becomes typed text.</li>
              <li>Blue guided boxes show OCR-ready areas across `CC / HP`, parameters, `Dx`, physical exam, and `Rx`.</li>
              <li>Normal ink and OCR text can live together in the same field without changing each other.</li>
              <li>`Scroll / Edit` lets you move around the sheet and use the checkboxes safely.</li>
            </>
          )}
          <li>Use `Convert to PDF` when the page looks right.</li>
        </ul>
      </div>

      {enableOcr ? (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-600">
        <p className="font-semibold text-slate-800">Quick OCR targets</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Pick a region, then write inside its highlighted box in `OCR write` mode.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {OCR_REGION_SHORTCUTS.map((fieldId) => (
            <button
              key={fieldId}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                selectedFieldId === fieldId && tool === "ocr"
                  ? "border-primary bg-primary text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
              onClick={() => {
                setSelectedFieldId(fieldId);
                setTool("ocr");
                setMessage(null);
                setError(null);
              }}
            >
              {OCR_REGION_SHORTCUT_LABELS[fieldId] ?? WRITABLE_REGION_LABELS[fieldId]}
            </button>
          ))}
        </div>
      </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[12px] text-slate-600">
        <p className="font-semibold text-slate-900">Selected region</p>
        <p className="mt-1 text-[13px] font-medium text-slate-800">{WRITABLE_REGION_LABELS[selectedFieldId]}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary btn-compact text-xs"
            disabled={!selectedRegionHasInk}
            onClick={() => clearWritableRegion(selectedFieldId)}
          >
            Clear region
          </button>
          {enableOcr ? (
            <button
              type="button"
              className="btn-primary btn-compact text-xs"
              disabled={!selectedRegionHasPendingOcrInk || ocrPendingFieldId === selectedFieldId}
              onClick={() => void recognizePendingOcrRegion(selectedFieldId)}
            >
              {ocrPendingFieldId === selectedFieldId ? "Running OCR..." : "Convert OCR to text"}
            </button>
          ) : null}
        </div>
        {enableOcr && ocrPendingFieldId === selectedFieldId ? (
          <p className="mt-3 text-[11px] font-medium text-primary">Converting your latest OCR stroke to typed text…</p>
        ) : null}
        {selectedRegion.text.trim() ? (
          <label className="mt-3 block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Legacy OCR text</span>
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
        ) : null}
        {selectedRegionTokens.length ? (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">OCR snippets</p>
            {selectedRegionTokens.map((token, index) => (
              <label key={token.id} className="block">
                <span className="text-[11px] text-slate-500">Snippet {index + 1}</span>
                <input
                  type="text"
                  value={token.text}
                  onFocus={() => handleSelectedTokenFocus(token.id)}
                  onBlur={handleSelectedTokenBlur}
                  onChange={(event) => handleSelectedTokenTextChange(token.id, event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[12px] text-slate-900 shadow-sm outline-none focus:border-primary"
                />
              </label>
            ))}
          </div>
        ) : !selectedRegion.text.trim() ? (
          <p className="mt-3 text-[11px] text-slate-500">
            Use either normal writing or OCR write in this region. The button under the pen switches to OCR writing, and
            `Convert OCR to text` replaces only those OCR strokes with typed text.
          </p>
        ) : null}
        <button type="button" className="btn-primary btn-compact mt-4 text-xs" disabled={pending} onClick={() => void savePdf()}>
          {pending ? "Converting to PDF…" : "Convert to PDF"}
        </button>
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
        <button type="button" aria-label="Normal write" title="Normal write" className={compactToolButtonClass(tool === "draw")} onClick={() => setTool("draw")}>
          <ToolIcon tool="draw" />
        </button>
        {enableOcr ? (
          <button type="button" aria-label="OCR write" title="OCR write" className={compactToolButtonClass(tool === "ocr")} onClick={() => setTool("ocr")}>
            <ToolIcon tool="ocr" />
          </button>
        ) : null}
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

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <span>Zoom</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          <div className="mt-1 flex gap-1">
            <button
              type="button"
              className="flex-1 rounded-md border border-slate-300 bg-white px-1 py-1 text-[10px] font-semibold text-slate-700 disabled:opacity-50"
              disabled={zoom <= 0.6}
              onClick={() => setZoom((current) => Math.max(0.6, Number((current - 0.1).toFixed(2))))}
            >
              -
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border border-slate-300 bg-white px-1 py-1 text-[10px] font-semibold text-slate-700"
              onClick={() => setZoom(1)}
            >
              100
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border border-slate-300 bg-white px-1 py-1 text-[10px] font-semibold text-slate-700 disabled:opacity-50"
              disabled={zoom >= 2}
              onClick={() => setZoom((current) => Math.min(2, Number((current + 0.1).toFixed(2))))}
            >
              +
            </button>
          </div>
        </div>

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
          className="w-full rounded-lg border border-primary/25 bg-white px-2 py-1.5 text-[11px] font-semibold text-primary disabled:opacity-50"
          disabled={!selectedRegionHasPendingOcrInk || ocrPendingFieldId === selectedFieldId}
          onClick={() => void recognizePendingOcrRegion(selectedFieldId)}
        >
          {ocrPendingFieldId === selectedFieldId ? "Running OCR..." : "OCR to text"}
        </button>
        <button
          type="button"
          className="w-full rounded-lg border border-primary bg-primary px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
          disabled={pending}
          onClick={() => void savePdf()}
        >
          {pending ? "Converting..." : "Convert PDF"}
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
        className={`absolute inset-0 z-[5] h-full w-full ${overlayPointerClass}`}
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
  const displayedSheetStage = (
    <div
      className="relative"
      style={{
        width: HANDWRITTEN_VISIT_SHEET_WIDTH * zoom,
        height: HANDWRITTEN_VISIT_SHEET_HEIGHT * zoom,
      }}
    >
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
        }}
      >
        {sheetStage}
      </div>
    </div>
  );

  return (
    <>
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-on-background">Interactive handwritten full visit sheet</p>
            <p className="text-[12px] text-on-surface-variant">
              Use two writing methods on the visit template: normal handwriting that stays as ink, and OCR write that turns
              only OCR-mode strokes into typed text after a short pause.
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
                  <div className="flex min-h-full items-start justify-center">{displayedSheetStage}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="font-headline text-base font-bold text-slate-900">Interactive handwritten full visit studio</p>
                    <p className="text-[12px] text-slate-600">
                      Normal write keeps your ink. OCR write converts only OCR-mode writing. Convert the finished page to PDF when ready.
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
                          ? "Scroll / Edit mode is on. Click checkboxes directly and move around the sheet safely."
                          : tool === "highlight"
                            ? "Highlight mode writes marker strokes across the whole template."
                            : tool === "erase"
                              ? "Eraser mode clears the writable region you tap."
                              : tool === "ocr"
                                ? "OCR write mode converts the latest OCR stroke group about 2 seconds after you stop writing, or when you press OCR to text."
                                : "Normal write mode lets you handwrite inside the dedicated writable regions without OCR."}
                      </div>
                      <button type="button" className="btn-primary btn-compact text-xs" disabled={pending} onClick={() => void savePdf()}>
                        {pending ? "Converting to PDF…" : "Convert to PDF"}
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto p-4">
                      <div className="mx-auto rounded-[24px] bg-white p-3 shadow-xl">{displayedSheetStage}</div>
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
