import { NextResponse } from "next/server";
import { dispatchPendingEmails, runReminderGeneration } from "@/app/(portal)/notifications-center/actions";

export async function POST(request: Request) {
  const provided = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const created = await runReminderGeneration();
  const sent = await dispatchPendingEmails();
  return NextResponse.json({ created, sent }, { status: 200 });
}
