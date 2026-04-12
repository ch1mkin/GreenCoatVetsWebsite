import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFImage } from "pdf-lib";
import type { VisitReportPayload } from "@/lib/visits/visit-report-data";

const PAGE_W = 595;
const PAGE_H = 842;
const BOX_INSET = 24;
const INNER_PAD = 26;
const L = BOX_INSET + INNER_PAD;
const R = PAGE_W - BOX_INSET - INNER_PAD;
const CONTENT_W = R - L;
const LINE_H = 13;
const BRAND = rgb(0, 108 / 255, 80 / 255);
const BRAND_DEEP = rgb(0, 76 / 255, 56 / 255);
const TEXT = rgb(0.12, 0.14, 0.16);
const MUTED = rgb(0.38, 0.42, 0.45);
const WHITE = rgb(1, 1, 1);

function sanitizePdfText(text: string): string {
  return text
    .replace(/\u20b9/g, "Rs.")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "--")
    .replace(/\u00a0/g, " ");
}

function wrapLines(text: string, maxChars: number): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return [];
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
  return out.length ? out : [];
}

function drawFrame(page: { drawRectangle: (o: Record<string, unknown>) => void }) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE, borderWidth: 0 });
  page.drawRectangle({
    x: BOX_INSET,
    y: BOX_INSET,
    width: PAGE_W - 2 * BOX_INSET,
    height: PAGE_H - 2 * BOX_INSET,
    color: WHITE,
    borderColor: rgb(0.86, 0.88, 0.9),
    borderWidth: 0.85,
  });
}

export async function buildVisitReportPdfBytes(
  payload: VisitReportPayload,
  logoBytes: Uint8Array | null
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_W, PAGE_H]);
  drawFrame(page);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logoImage: PDFImage | null = null;
  if (logoBytes?.length) {
    try {
      logoImage = await doc.embedPng(logoBytes);
    } catch {
      try {
        logoImage = await doc.embedJpg(logoBytes);
      } catch {
        logoImage = null;
      }
    }
  }

  let y = PAGE_H - BOX_INSET - 20;
  const bandH = 56;
  page.drawRectangle({
    x: BOX_INSET,
    y: PAGE_H - BOX_INSET - bandH,
    width: PAGE_W - 2 * BOX_INSET,
    height: bandH,
    color: BRAND,
    borderWidth: 0,
  });

  let lx = L;
  if (logoImage) {
    const maxL = 40;
    const iw = logoImage.width;
    const ih = logoImage.height;
    const sc = Math.min(maxL / iw, maxL / ih, 1);
    const lw = iw * sc;
    const lh = ih * sc;
    page.drawImage(logoImage, {
      x: L,
      y: PAGE_H - BOX_INSET - bandH + (bandH - lh) / 2,
      width: lw,
      height: lh,
    });
    lx = L + lw + 10;
  }

  page.drawText(sanitizePdfText(payload.clinicName), {
    x: lx,
    y: PAGE_H - BOX_INSET - 26,
    size: 14,
    font: fontBold,
    color: WHITE,
    maxWidth: R - lx - 8,
  });
  page.drawText("Visit summary report", {
    x: lx,
    y: PAGE_H - BOX_INSET - 44,
    size: 10,
    font,
    color: rgb(0.92, 1, 0.96),
  });

  y = PAGE_H - BOX_INSET - bandH - 18;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    drawFrame(page);
    y = PAGE_H - BOX_INSET - 22;
  };

  const ensure = (need: number) => {
    if (y < BOX_INSET + 80 + need) newPage();
  };

  const heading = (t: string) => {
    ensure(28);
    page.drawText(sanitizePdfText(t), { x: L, y, size: 11, font: fontBold, color: BRAND_DEEP });
    y -= 16;
  };

  const body = (text: string, size = 9) => {
    const lines = wrapLines(sanitizePdfText(text), 92);
    if (!lines.length) return;
    for (const line of lines) {
      ensure(LINE_H + 4);
      page.drawText(line, {
        x: L,
        y,
        size,
        font,
        color: TEXT,
        maxWidth: CONTENT_W,
      });
      y -= LINE_H * (size / 9);
    }
    y -= 4;
  };

  const kv = (label: string, value: string) => {
    const v = value.trim();
    if (!v) return;
    ensure(20);
    page.drawText(`${sanitizePdfText(label)}:`, { x: L, y, size: 8, font: fontBold, color: MUTED });
    y -= 11;
    body(v, 9);
  };

  heading("Patient & visit");
  kv("Patient", `${payload.petName} (${payload.petSpecies})`);
  kv("Owner", payload.ownerName);
  kv("Branch", payload.branchName);
  kv("Veterinarian", payload.doctorName);
  kv("Visit date", payload.visitWhen);
  if (payload.completedWhen !== "—") kv("Completed", payload.completedWhen);
  y -= 4;

  heading("Clinical evaluation");
  kv("Patient complaint", payload.patientComplaint);
  kv("CC / HPI", payload.ccHp);
  kv("Physical examination", payload.physicalExam);
  kv("Deworming", payload.deworming);
  kv("Vaccination", payload.vaccination);
  if (payload.paramsLine) kv("Parameters", payload.paramsLine);
  if (payload.testsReferred) kv("Tests referred", payload.testsReferred);
  if (payload.testsOther) kv("Other tests", payload.testsOther);
  y -= 4;

  heading("Consultation (SOAP)");
  kv("Symptoms / subjective", payload.symptoms);
  kv("Diagnosis / assessment", payload.diagnosis);
  kv("Treatment plan", payload.treatmentPlan);
  if (payload.followUp) kv("Follow-up", payload.followUp);
  y -= 4;

  heading("Prescription");
  if (!payload.rxLines.length) {
    body("No prescription lines recorded for this visit.", 9);
  } else {
    for (const row of payload.rxLines) {
      ensure(36);
      const line = `${row.medicine_name} — ${row.dosage}${row.frequency ? `; ${row.frequency}` : ""}${row.duration ? `; ${row.duration}` : ""}${row.instructions ? `. ${row.instructions}` : ""}`;
      body(line, 9);
    }
  }

  y -= 8;
  ensure(40);
  page.drawText(sanitizePdfText("This report summarizes EMR data at generation time. For urgent concerns, contact the clinic."), {
    x: L,
    y: Math.max(y, BOX_INSET + 50),
    size: 7,
    font,
    color: MUTED,
    maxWidth: CONTENT_W,
  });

  return doc.save();
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadVisitReportPayload } from "@/lib/visits/visit-report-data";
import { fetchClinicLogoBytesForPdf } from "@/lib/invoicing/fetch-clinic-logo";

export async function buildVisitReportPdfForVisit(supabase: SupabaseClient, visitId: string): Promise<Uint8Array> {
  const payload = await loadVisitReportPayload(supabase, visitId);
  const { data: branding } = await supabase.from("platform_branding").select("logo_url").eq("id", "default").maybeSingle();
  const logoBytes = await fetchClinicLogoBytesForPdf(supabase, (branding?.logo_url as string | null) ?? null);
  return buildVisitReportPdfBytes(payload, logoBytes);
}
