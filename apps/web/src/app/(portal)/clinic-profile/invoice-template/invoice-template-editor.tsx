"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState, useTransition } from "react";
import {
  generateInvoiceTemplatePreviewPdf,
  type InvoiceTemplatePreviewSample,
  saveInvoiceTemplateLayout,
} from "@/app/(portal)/invoicing/actions";
import {
  DEFAULT_INVOICE_TEMPLATE_LAYOUT,
  type InvoiceTemplateBlock,
  type InvoiceTemplateLayout,
  normalizeInvoiceTemplateLayout,
} from "@/lib/invoicing/invoice-template";

const BLOCK_LABELS: Record<string, string> = {
  clinic_header: "Clinic header & branch address",
  invoice_meta: "Invoice number & date",
  owner_patient: "Owner & patient",
  line_items: "Line items table",
  totals: "Subtotal, tax, total",
  footer_note: "Footer note",
  custom_text: "Custom text block",
};

function SortableRow({
  block,
  onToggle,
  onFooterChange,
  onCustomChange,
  onRemove,
}: {
  block: InvoiceTemplateBlock;
  onToggle: (id: string) => void;
  onFooterChange: (id: string, value: string) => void;
  onCustomChange: (id: string, field: "title" | "body", value: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-2 rounded-md border border-outline-variant/20 bg-surface-container-lowest/80 p-2.5 sm:flex-row sm:items-start"
    >
      <button
        type="button"
        className="mt-1 flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-md border border-outline-variant/30 text-on-surface-variant active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <span className="material-symbols-outlined text-lg">drag_indicator</span>
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.enabled}
              onChange={() => onToggle(block.id)}
              className="rounded border-outline-variant"
            />
            <span className="font-semibold text-on-background">{BLOCK_LABELS[block.type] ?? block.type}</span>
          </label>
          {block.type === "custom_text" ? (
            <button type="button" className="text-xs font-semibold text-error" onClick={() => onRemove(block.id)}>
              Remove block
            </button>
          ) : null}
        </div>
        {block.type === "footer_note" ? (
          <textarea
            className="input-soft min-h-[72px] w-full text-sm"
            placeholder="Optional footer text on every invoice PDF"
            value={block.customText ?? ""}
            onChange={(e) => onFooterChange(block.id, e.target.value)}
          />
        ) : null}
        {block.type === "custom_text" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="input-soft text-sm"
              placeholder="Title"
              value={block.title ?? ""}
              onChange={(e) => onCustomChange(block.id, "title", e.target.value)}
            />
            <textarea
              className="input-soft min-h-[72px] text-sm sm:col-span-2"
              placeholder="Body text"
              value={block.body ?? ""}
              onChange={(e) => onCustomChange(block.id, "body", e.target.value)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function InvoiceTemplateEditor({ initial }: { initial: InvoiceTemplateLayout }) {
  const normalized = useMemo(() => normalizeInvoiceTemplateLayout(initial), [initial]);
  const [blocks, setBlocks] = useState<InvoiceTemplateBlock[]>(() =>
    [...normalized.blocks].sort((a, b) => a.order - b.order)
  );
  const [preview, setPreview] = useState<InvoiceTemplatePreviewSample>({
    clinicName: "Sample Veterinary Clinic",
    branchLine1: "12 Demo Road, Andheri East",
    branchLine2: "Mumbai, Maharashtra 400059",
    invoiceNumber: "INV-PREVIEW-001",
    ownerName: "Priya Sharma",
    patientName: "Bruno (Golden Retriever)",
    line1Description: "Consultation fee",
    line1Qty: 1,
    line1Unit: 850,
    line2Description: "Vaccination — DHPPi",
    line2Qty: 1,
    line2Unit: 1200,
    taxRatePercent: 18,
    discountTotal: 0,
    notes: "Sample invoice — numbers below are for preview only.",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const orderedIds = blocks.map((b) => b.id);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(blocks, oldIndex, newIndex).map((b, i) => ({ ...b, order: i }));
    setBlocks(next);
  };

  const toggle = (id: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b)));
  };

  const footerChange = (id: string, value: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, customText: value } : b)));
  };

  const customChange = (id: string, field: "title" | "body", value: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i })));
  };

  const addCustomBlock = () => {
    const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
    setBlocks((prev) => [
      ...prev,
      {
        id,
        type: "custom_text",
        order: prev.length,
        enabled: true,
        title: "",
        body: "",
      },
    ]);
  };

  const resetDefault = () => {
    const clone = JSON.parse(JSON.stringify(DEFAULT_INVOICE_TEMPLATE_LAYOUT.blocks)) as InvoiceTemplateBlock[];
    setBlocks(clone.map((b, i) => ({ ...b, order: i })));
  };

  const save = () => {
    setMessage(null);
    setErr(null);
    startTransition(async () => {
      try {
        await saveInvoiceTemplateLayout({ blocks });
        setMessage("Template saved.");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Save failed.");
      }
    });
  };

  const openPreview = async () => {
    setErr(null);
    setPreviewPending(true);
    try {
      const layout: InvoiceTemplateLayout = { blocks: blocks.map((b, i) => ({ ...b, order: i })) };
      const { base64 } = await generateInvoiceTemplatePreviewPdf(layout, {
        ...preview,
        line1Qty: Number(preview.line1Qty),
        line1Unit: Number(preview.line1Unit),
        line2Qty: preview.line2Qty != null ? Number(preview.line2Qty) : undefined,
        line2Unit: preview.line2Unit != null ? Number(preview.line2Unit) : undefined,
        taxRatePercent: preview.taxRatePercent != null ? Number(preview.taxRatePercent) : undefined,
        discountTotal: preview.discountTotal != null ? Number(preview.discountTotal) : undefined,
      });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setPreviewPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        Drag blocks to change the order of sections on generated invoice PDFs. Disabled blocks are skipped. Custom text
        blocks are optional extras (e.g. bank details, terms).
      </p>

      <div className="rounded-md border border-slate-200/90 bg-slate-50/80 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Preview sample data (PDF)</p>
        <p className="mt-1 text-[11px] text-slate-600">
          Edit values below, then open a preview PDF with your current block order and visibility — no invoice is saved.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["clinicName", "Clinic name"],
              ["branchLine1", "Address line 1"],
              ["branchLine2", "Address line 2"],
              ["invoiceNumber", "Invoice no."],
              ["ownerName", "Owner"],
              ["patientName", "Patient"],
              ["line1Description", "Line 1 description"],
              ["line1Qty", "Line 1 qty"],
              ["line1Unit", "Line 1 unit (₹)"],
              ["line2Description", "Line 2 description (optional)"],
              ["line2Qty", "Line 2 qty"],
              ["line2Unit", "Line 2 unit (₹)"],
              ["taxRatePercent", "GST %"],
              ["discountTotal", "Discount (₹)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-0.5 text-[11px]">
              <span className="font-semibold text-slate-700">{label}</span>
              <input
                className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-900"
                value={String((preview as Record<string, unknown>)[key] ?? "")}
                onChange={(e) => {
                  const v = e.target.value;
                  setPreview((p) => ({
                    ...p,
                    [key]:
                      key.includes("Qty") || key.includes("Unit") || key === "taxRatePercent" || key === "discountTotal"
                        ? v === ""
                          ? undefined
                          : Number(v)
                        : v,
                  }));
                }}
              />
            </label>
          ))}
        </div>
        <label className="mt-2 flex flex-col gap-0.5 text-[11px]">
          <span className="font-semibold text-slate-700">Notes (footer)</span>
          <textarea
            className="min-h-[52px] rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-900"
            value={preview.notes ?? ""}
            onChange={(e) => setPreview((p) => ({ ...p, notes: e.target.value }))}
          />
        </label>
        <button
          type="button"
          className="btn-primary btn-compact mt-3"
          disabled={previewPending}
          onClick={() => void openPreview()}
        >
          {previewPending ? "Opening…" : "Open PDF preview"}
        </button>
      </div>
      {message ? <p className="rounded-lg border border-primary/30 bg-primary-container/20 px-3 py-2 text-sm">{message}</p> : null}
      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{err}</p>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {blocks.map((block) => (
              <SortableRow
                key={block.id}
                block={block}
                onToggle={toggle}
                onFooterChange={footerChange}
                onCustomChange={customChange}
                onRemove={removeBlock}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary text-sm" onClick={addCustomBlock}>
          Add custom text block
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={resetDefault}>
          Reset to default layout
        </button>
        <button type="button" className="btn-primary text-sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save template"}
        </button>
      </div>
    </div>
  );
}
