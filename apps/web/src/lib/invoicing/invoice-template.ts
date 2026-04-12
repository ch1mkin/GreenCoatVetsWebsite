/** Admin-configurable invoice PDF sections (order + visibility + optional custom blocks). */

export type InvoiceTemplateBlockType =
  | "clinic_header"
  | "invoice_meta"
  | "owner_patient"
  | "line_items"
  | "totals"
  | "footer_note"
  | "custom_text";

export type InvoiceTemplateBlock = {
  id: string;
  type: InvoiceTemplateBlockType;
  order: number;
  enabled: boolean;
  customText?: string;
  title?: string;
  body?: string;
};

export type InvoiceTemplateLayout = {
  blocks: InvoiceTemplateBlock[];
};

export const DEFAULT_INVOICE_TEMPLATE_LAYOUT: InvoiceTemplateLayout = {
  blocks: [
    { id: "blk-h", type: "clinic_header", order: 0, enabled: true },
    { id: "blk-m", type: "invoice_meta", order: 1, enabled: true },
    { id: "blk-p", type: "owner_patient", order: 2, enabled: true },
    { id: "blk-l", type: "line_items", order: 3, enabled: true },
    { id: "blk-t", type: "totals", order: 4, enabled: true },
    { id: "blk-f", type: "footer_note", order: 5, enabled: true, customText: "" },
  ],
};

export function normalizeInvoiceTemplateLayout(raw: unknown): InvoiceTemplateLayout {
  if (!raw || typeof raw !== "object") return DEFAULT_INVOICE_TEMPLATE_LAYOUT;
  const blocks = (raw as InvoiceTemplateLayout).blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return DEFAULT_INVOICE_TEMPLATE_LAYOUT;
  const cleaned: InvoiceTemplateBlock[] = blocks
    .filter((b): b is InvoiceTemplateBlock => {
      if (!b || typeof b !== "object") return false;
      const t = (b as InvoiceTemplateBlock).type;
      return typeof t === "string";
    })
    .map((b, i) => ({
      id: typeof b.id === "string" && b.id ? b.id : `blk-${i}`,
      type: b.type,
      order: typeof b.order === "number" ? b.order : i,
      enabled: b.enabled !== false,
      customText: typeof b.customText === "string" ? b.customText : undefined,
      title: typeof b.title === "string" ? b.title : undefined,
      body: typeof b.body === "string" ? b.body : undefined,
    }))
    .sort((a, b) => a.order - b.order);
  return { blocks: cleaned.length ? cleaned : DEFAULT_INVOICE_TEMPLATE_LAYOUT.blocks };
}
