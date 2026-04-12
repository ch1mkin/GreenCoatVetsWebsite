import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { assertVisitReportAccess } from "@/lib/visits/visit-report-access";
import { buildVisitReportPdfForVisit } from "@/lib/pdf/visit-report-pdf";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const access = await getUserAccess();
  const supabase = createClient();
  try {
    await assertVisitReportAccess(supabase, access, params.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Forbidden";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  try {
    const bytes = await buildVisitReportPdfForVisit(supabase, params.id);
    return new NextResponse(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="visit-report-${params.id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to build PDF";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
