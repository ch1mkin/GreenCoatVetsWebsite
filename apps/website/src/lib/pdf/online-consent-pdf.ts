import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function buildOnlineConsultConsentPdf(input: {
  clinicName: string;
  ownerName: string;
  petName: string;
  signedAtIso: string;
  consentText: string;
  signaturePngBase64?: string | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;

  const draw = (text: string, size = 11, useBold = false) => {
    page.drawText(text, { x: 48, y, size, font: useBold ? bold : font, color: rgb(0.1, 0.2, 0.16), maxWidth: 500 });
    y -= size + 10;
  };

  draw("Senior Veterinarian — Online consultation consent", 16, true);
  draw(`Clinic: ${input.clinicName}`);
  draw(`Owner: ${input.ownerName}`);
  draw(`Pet: ${input.petName}`);
  draw(`Signed at: ${new Date(input.signedAtIso).toLocaleString()}`);
  y -= 8;
  for (const line of input.consentText.split("\n")) {
    draw(line, 10);
  }

  if (input.signaturePngBase64?.startsWith("data:image/png")) {
    try {
      const raw = input.signaturePngBase64.split(",")[1];
      const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      const img = await doc.embedPng(bytes);
      const dims = img.scale(0.35);
      page.drawImage(img, { x: 48, y: Math.max(80, y - 120), width: dims.width, height: dims.height });
    } catch {
      draw("(Signature image could not be embedded)");
    }
  }

  return doc.save();
}
