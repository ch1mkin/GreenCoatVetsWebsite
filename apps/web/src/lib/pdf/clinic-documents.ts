import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFImage } from "pdf-lib";
import { normalizeInvoiceTemplateLayout } from "@/lib/invoicing/invoice-template";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 48;
const LINE_H = 13;
const MAX_LINE_CHARS = 85;
/** Reserve space at bottom of every page for footer band + disclaimer (prevents overlap). */
const FOOTER_H = 44;

/** Veterinary brand palette (teal / mint) — readable on white and in headers. */
const VET_TEAL = rgb(0.06, 0.44, 0.4);
const VET_TEAL_DEEP = rgb(0.04, 0.32, 0.3);
const TEXT_MAIN = rgb(0.12, 0.14, 0.16);
const TEXT_MUTED = rgb(0.38, 0.42, 0.45);
const ROW_ALT = rgb(0.93, 0.97, 0.96);
const TABLE_HEAD = rgb(0.82, 0.93, 0.9);

/**
 * Standard 14 PDF fonts (Helvetica) encode text as WinAnsi — no ₹, €, smart quotes, etc.
 */
function sanitizePdfText(text: string): string {
  return text
    .replace(/\u20b9/g, "Rs.")
    .replace(/\u20ac/g, "EUR ")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "--")
    .replace(/\u00a0/g, " ");
}

function currencyLabel(c: string): string {
  const t = sanitizePdfText(c).trim().toUpperCase();
  if (t === "INR" || t === "RS." || !t) return "Rs.";
  return sanitizePdfText(c);
}

function wrapLines(text: string, maxChars: number): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return [""];
  const out: string[] = [];
  for (const para of t.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > maxChars) {
        if (cur) out.push(cur);
        cur = w.length > maxChars ? w.slice(0, maxChars) : w;
      } else {
        cur = next;
      }
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : [""];
}

type InvoiceLineRow = {
  description: string;
  qty: number;
  unit: number;
  total: number;
};

function drawRight(
  page: { drawText: (t: string, o: Record<string, unknown>) => void },
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  color = TEXT_MAIN
) {
  const t = sanitizePdfText(text);
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: rightX - w, y, size, font, color });
}

export async function buildInvoicePdfBytes(opts: {
  layout: unknown;
  clinicName: string;
  branchLines: string[];
  invoiceNumber: string;
  issuedAt: Date;
  currency: string;
  ownerName: string;
  patientName: string;
  lines: InvoiceLineRow[];
  subtotal: number;
  taxRate: number | null;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  notes?: string | null;
  /** Optional clinic logo (PNG or JPEG bytes). */
  logoBytes?: Uint8Array | null;
}): Promise<Uint8Array> {
  const layout = normalizeInvoiceTemplateLayout(opts.layout);
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logoImage: PDFImage | null = null;
  if (opts.logoBytes && opts.logoBytes.length > 0) {
    try {
      logoImage = await doc.embedPng(opts.logoBytes);
    } catch {
      try {
        logoImage = await doc.embedJpg(opts.logoBytes);
      } catch {
        logoImage = null;
      }
    }
  }

  const cur = currencyLabel(opts.currency);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const ensureSpace = (need: number) => {
    if (y < MARGIN + FOOTER_H + need) newPage();
  };

  const drawPlain = (text: string, size = 10, bold = false, color = TEXT_MAIN) => {
    for (const line of wrapLines(sanitizePdfText(text), MAX_LINE_CHARS)) {
      ensureSpace(24);
      page.drawText(line, {
        x: MARGIN,
        y,
        size,
        font: bold ? fontBold : font,
        color,
        maxWidth: PAGE_W - MARGIN * 2,
      });
      y -= LINE_H * (size / 10);
    }
  };

  const blocks = [...layout.blocks].filter((b) => b.enabled).sort((a, b) => a.order - b.order);
  const hasClinicHeader = blocks.some((b) => b.enabled && b.type === "clinic_header");
  const invoiceMetaInLayout = blocks.some((b) => b.enabled && b.type === "invoice_meta");
  let metaMergedInBanner = false;

  const drawVeterinaryBanner = () => {
    const bandH = 88;
    page.drawRectangle({
      x: 0,
      y: PAGE_H - bandH,
      width: PAGE_W,
      height: bandH,
      color: VET_TEAL,
      borderWidth: 0,
    });
    const top = PAGE_H - 28;
    let leftX = MARGIN;
    if (logoImage) {
      const maxLogo = 52;
      const iw = logoImage.width;
      const ih = logoImage.height;
      const scale = Math.min(maxLogo / iw, maxLogo / ih, 1);
      const lw = iw * scale;
      const lh = ih * scale;
      page.drawImage(logoImage, {
        x: MARGIN,
        y: PAGE_H - bandH + (bandH - lh) / 2,
        width: lw,
        height: lh,
      });
      leftX = MARGIN + lw + 14;
    }

    const name = sanitizePdfText(opts.clinicName);
    const nameLines = wrapLines(name, 36).slice(0, 3);
    let nameY = top;
    const nameSize = nameLines.length > 1 ? 15 : 18;
    for (const nl of nameLines) {
      page.drawText(nl, {
        x: leftX,
        y: nameY,
        size: nameSize,
        font: fontBold,
        color: rgb(1, 1, 1),
        maxWidth: PAGE_W - leftX - MARGIN - 8,
      });
      nameY -= nameLines.length > 1 ? 16 : 20;
    }

    const invLabel = "TAX INVOICE";
    const metaTop = nameLines.length > 1 ? top - 6 : top;
    drawRight(page, invLabel, PAGE_W - MARGIN, metaTop, 9, fontBold, rgb(0.85, 0.95, 0.93));
    drawRight(page, `# ${sanitizePdfText(opts.invoiceNumber)}`, PAGE_W - MARGIN, metaTop - 14, 10, fontBold, rgb(1, 1, 1));
    drawRight(
      page,
      opts.issuedAt.toLocaleString(),
      PAGE_W - MARGIN,
      metaTop - 28,
      8,
      font,
      rgb(0.88, 0.96, 0.94)
    );

    y = PAGE_H - bandH - 18;
    metaMergedInBanner = true;

    for (const line of opts.branchLines) {
      if (!line.trim()) continue;
      page.drawText(sanitizePdfText(line.trim()), {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: TEXT_MUTED,
        maxWidth: PAGE_W - MARGIN * 2,
      });
      y -= LINE_H * 0.95;
    }
    y -= 10;
  };

  const drawInvoiceMetaStandalone = () => {
    drawPlain("Tax invoice", 14, true, VET_TEAL_DEEP);
    drawPlain(`Invoice no: ${opts.invoiceNumber}`, 11, true);
    drawPlain(`Date: ${opts.issuedAt.toLocaleString()}`, 10);
    y -= 6;
  };

  const drawOwnerPatient = () => {
    const ownerLines = wrapLines(`Owner: ${sanitizePdfText(opts.ownerName)}`, 78);
    const patientLines = wrapLines(`Patient: ${sanitizePdfText(opts.patientName)}`, 78);
    const innerLines = 1 + ownerLines.length + patientLines.length;
    const boxH = Math.max(52, 16 + innerLines * LINE_H + 12);
    ensureSpace(boxH + 20);

    page.drawRectangle({
      x: MARGIN - 4,
      y: y - boxH,
      width: PAGE_W - (MARGIN - 4) * 2,
      height: boxH,
      color: ROW_ALT,
      borderColor: TABLE_HEAD,
      borderWidth: 0.8,
    });
    const blockTop = y - 14;
    page.drawText("Bill to", { x: MARGIN + 6, y: blockTop, size: 8, font: fontBold, color: VET_TEAL_DEEP });
    let lineY = blockTop - 14;
    for (const ol of ownerLines) {
      page.drawText(sanitizePdfText(ol), {
        x: MARGIN + 6,
        y: lineY,
        size: 10,
        font: fontBold,
        color: TEXT_MAIN,
        maxWidth: PAGE_W - MARGIN * 2 - 8,
      });
      lineY -= LINE_H;
    }
    for (const pl of patientLines) {
      page.drawText(sanitizePdfText(pl), {
        x: MARGIN + 6,
        y: lineY,
        size: 10,
        font,
        color: TEXT_MAIN,
        maxWidth: PAGE_W - MARGIN * 2 - 8,
      });
      lineY -= LINE_H;
    }
    y = y - boxH - 14;
  };

  const drawLineItemsTable = () => {
    const colQty = PAGE_W - MARGIN - 160;
    const colUnit = PAGE_W - MARGIN - 105;
    const colAmt = PAGE_W - MARGIN;

    ensureSpace(40);
    page.drawRectangle({
      x: MARGIN,
      y: y - 22,
      width: PAGE_W - MARGIN * 2,
      height: 22,
      color: TABLE_HEAD,
      borderColor: VET_TEAL,
      borderWidth: 0.6,
    });
    page.drawText("Description", { x: MARGIN + 6, y: y - 14, size: 9, font: fontBold, color: VET_TEAL_DEEP });
    drawRight(page, "Qty", colQty + 18, y - 14, 9, fontBold, VET_TEAL_DEEP);
    drawRight(page, `Unit (${cur})`, colUnit + 28, y - 14, 8, fontBold, VET_TEAL_DEEP);
    drawRight(page, `Amount (${cur})`, colAmt, y - 14, 8, fontBold, VET_TEAL_DEEP);
    y -= 28;

    let rowIdx = 0;
    for (const row of opts.lines) {
      const descLines = wrapLines(row.description, 48);
      const rowH = Math.max(descLines.length, 1) * LINE_H + 10;
      ensureSpace(rowH + 20);

      const bg = rowIdx % 2 === 0 ? rgb(1, 1, 1) : ROW_ALT;
      page.drawRectangle({
        x: MARGIN,
        y: y - rowH + 4,
        width: PAGE_W - MARGIN * 2,
        height: rowH,
        color: bg,
        borderColor: rgb(0.9, 0.92, 0.92),
        borderWidth: 0.35,
      });

      let lineY = y - 12;
      for (let i = 0; i < descLines.length; i++) {
        page.drawText(sanitizePdfText(descLines[i]), {
          x: MARGIN + 6,
          y: lineY,
          size: 9,
          font,
          color: TEXT_MAIN,
          maxWidth: PAGE_W - MARGIN * 2 - 220,
        });
        if (i === 0) {
          drawRight(page, String(row.qty), colQty + 18, lineY, 9, font, TEXT_MAIN);
          drawRight(page, row.unit.toFixed(2), colUnit + 28, lineY, 9, font, TEXT_MAIN);
          drawRight(page, row.total.toFixed(2), colAmt, lineY, 9, fontBold, TEXT_MAIN);
        }
        lineY -= LINE_H;
      }
      y -= rowH;
      rowIdx += 1;
    }
    y -= 8;
  };

  const drawTotals = () => {
    const rightBlock = PAGE_W - MARGIN - 4;
    const labelX = PAGE_W - 260;
    ensureSpace(100);
    y -= 4;
    page.drawText("Subtotal", { x: labelX, y, size: 10, font, color: TEXT_MUTED });
    drawRight(page, `${cur} ${opts.subtotal.toFixed(2)}`, rightBlock, y, 10, font, TEXT_MAIN);
    y -= 16;
    if (opts.taxRate != null && opts.taxRate > 0) {
      page.drawText(`Tax (${opts.taxRate}%)`, { x: labelX, y, size: 10, font, color: TEXT_MUTED });
      drawRight(page, `${cur} ${opts.taxTotal.toFixed(2)}`, rightBlock, y, 10, font, TEXT_MAIN);
      y -= 16;
    } else if (opts.taxTotal > 0) {
      page.drawText("Tax", { x: labelX, y, size: 10, font, color: TEXT_MUTED });
      drawRight(page, `${cur} ${opts.taxTotal.toFixed(2)}`, rightBlock, y, 10, font, TEXT_MAIN);
      y -= 16;
    }
    if (opts.discountTotal > 0) {
      page.drawText("Discount", { x: labelX, y, size: 10, font, color: TEXT_MUTED });
      drawRight(page, `-${cur} ${opts.discountTotal.toFixed(2)}`, rightBlock, y, 10, font, TEXT_MAIN);
      y -= 16;
    }
    y -= 4;
    page.drawRectangle({
      x: labelX - 6,
      y: y - 20,
      width: PAGE_W - labelX + MARGIN + 2,
      height: 24,
      color: TABLE_HEAD,
      borderColor: VET_TEAL,
      borderWidth: 0.8,
    });
    page.drawText("Total due", { x: labelX, y: y - 12, size: 11, font: fontBold, color: VET_TEAL_DEEP });
    drawRight(page, `${cur} ${opts.grandTotal.toFixed(2)}`, rightBlock, y - 12, 12, fontBold, VET_TEAL_DEEP);
    y -= 36;
  };

  if (!hasClinicHeader && !invoiceMetaInLayout) {
    drawInvoiceMetaStandalone();
  }

  for (const block of blocks) {
    switch (block.type) {
      case "clinic_header":
        drawVeterinaryBanner();
        break;
      case "invoice_meta":
        if (!metaMergedInBanner) drawInvoiceMetaStandalone();
        break;
      case "owner_patient":
        drawOwnerPatient();
        break;
      case "line_items":
        drawLineItemsTable();
        break;
      case "totals":
        drawTotals();
        break;
      case "footer_note": {
        const foot = (block.customText ?? "").trim();
        if (foot) {
          drawPlain(foot, 9, false, TEXT_MUTED);
          y -= 4;
        }
        break;
      }
      case "custom_text": {
        const title = (block.title ?? "").trim();
        const body = (block.body ?? "").trim();
        if (title) drawPlain(title, 11, true);
        if (body) drawPlain(body, 9);
        y -= 4;
        break;
      }
      default:
        break;
    }
  }

  if (opts.notes?.trim()) {
    y -= 8;
    drawPlain("Notes", 10, true, VET_TEAL_DEEP);
    drawPlain(opts.notes.trim(), 9);
  }

  const footerLine1 =
    "This is a digitally generated invoice. It is valid without a physical signature.";
  const footerLine2 = "Computer-generated document — subject to clinic terms and applicable law.";
  const pages = doc.getPages();
  for (const p of pages) {
    const bandH = 36;
    p.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_W,
      height: bandH,
      color: rgb(0.93, 0.96, 0.95),
      borderColor: rgb(0.78, 0.9, 0.86),
      borderWidth: 0.4,
    });
    p.drawText(sanitizePdfText(footerLine1), {
      x: MARGIN,
      y: 18,
      size: 7,
      font,
      color: TEXT_MUTED,
      maxWidth: PAGE_W - MARGIN * 2,
    });
    p.drawText(sanitizePdfText(footerLine2), {
      x: MARGIN,
      y: 8,
      size: 7,
      font,
      color: TEXT_MUTED,
      maxWidth: PAGE_W - MARGIN * 2,
    });
  }

  return doc.save();
}

export async function buildPrescriptionPdfBytes(opts: {
  clinicName: string;
  petName: string;
  ownerName: string;
  doctorName: string;
  issuedAt: Date;
  /** Optional clinic logo (PNG or JPEG bytes). */
  logoBytes?: Uint8Array | null;
  items: Array<{
    medicine_name: string;
    dosage: string;
    frequency: string | null;
    duration: string | null;
    instructions: string | null;
  }>;
  notes?: string | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let logoImage: PDFImage | null = null;
  if (opts.logoBytes && opts.logoBytes.length > 0) {
    try {
      logoImage = await doc.embedPng(opts.logoBytes);
    } catch {
      try {
        logoImage = await doc.embedJpg(opts.logoBytes);
      } catch {
        logoImage = null;
      }
    }
  }
  let y = PAGE_H - MARGIN;

  const spacerBlock = (n: number) => {
    y -= LINE_H * n;
  };

  const draw = (text: string, size = 11, bold = false) => {
    for (const line of wrapLines(sanitizePdfText(text), MAX_LINE_CHARS)) {
      if (y < MARGIN + 40) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
      page.drawText(line, {
        x: MARGIN,
        y,
        size,
        font: bold ? fontBold : font,
        color: TEXT_MAIN,
      });
      y -= LINE_H * (size / 11);
    }
  };

  const bannerH = 84;
  page.drawRectangle({
    x: 0,
    y: PAGE_H - bannerH,
    width: PAGE_W,
    height: bannerH,
    color: VET_TEAL,
  });
  let bannerLeft = MARGIN;
  if (logoImage) {
    const maxLogo = 46;
    const scale = Math.min(maxLogo / logoImage.width, maxLogo / logoImage.height, 1);
    const lw = logoImage.width * scale;
    const lh = logoImage.height * scale;
    page.drawImage(logoImage, {
      x: MARGIN,
      y: PAGE_H - bannerH + (bannerH - lh) / 2,
      width: lw,
      height: lh,
    });
    bannerLeft = MARGIN + lw + 12;
  }
  page.drawText(sanitizePdfText(opts.clinicName), {
    x: bannerLeft,
    y: PAGE_H - 34,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
    maxWidth: PAGE_W - bannerLeft - MARGIN,
  });
  page.drawText("PRESCRIPTION", {
    x: bannerLeft,
    y: PAGE_H - 54,
    size: 10,
    font: fontBold,
    color: rgb(0.88, 0.96, 0.94),
  });
  drawRight(page, opts.issuedAt.toLocaleString(), PAGE_W - MARGIN, PAGE_H - 56, 9, font, rgb(0.9, 0.97, 0.95));
  y = PAGE_H - bannerH - 18;

  spacerBlock(1);

  draw(`Patient: ${opts.petName}`, 11, true);
  draw(`Owner: ${opts.ownerName}`, 11);
  draw(`Veterinarian: ${opts.doctorName}`, 11);
  spacerBlock(1);

  let n = 1;
  draw("Medicines", 11, true);
  spacerBlock(0.3);
  for (const it of opts.items) {
    draw(`${n}. ${it.medicine_name}`, 11, true);
    draw(`Dosage: ${it.dosage}`, 10);
    if (it.frequency) draw(`Frequency: ${it.frequency}`, 10);
    if (it.duration) draw(`Duration: ${it.duration}`, 10);
    if (it.instructions) draw(`Instructions: ${it.instructions}`, 9);
    spacerBlock(0.6);
    n += 1;
  }

  if (opts.notes?.trim()) {
    draw("Notes", 10, true);
    draw(opts.notes.trim(), 9);
  }

  const pages = doc.getPages();
  for (const p of pages) {
    p.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_W,
      height: 28,
      color: rgb(0.93, 0.96, 0.95),
      borderColor: rgb(0.78, 0.9, 0.86),
      borderWidth: 0.4,
    });
    p.drawText("Veterinary clinical prescription (digitally generated)", {
      x: MARGIN,
      y: 10,
      size: 7,
      font,
      color: TEXT_MUTED,
      maxWidth: PAGE_W - MARGIN * 2,
    });
  }

  return doc.save();
}
