"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createHostingerTransport, getHostingerFromAddress } from "@/lib/email/hostinger-mail";
import { renderBrandedEmail } from "@/lib/email/render-branded-email";
import { getPlatformBranding } from "@/lib/platform-branding";
import { createClient } from "@/lib/supabase/server";

type NotificationInsert = {
  clinic_id: string;
  owner_id: string | null;
  user_id: string | null;
  channel: "push" | "email" | "sms" | "whatsapp";
  title: string;
  message: string;
  payload: Record<string, string>;
};

function joinedPetName(pets: unknown): string {
  if (pets == null) return "your pet";
  if (Array.isArray(pets)) {
    return (pets[0] as { name?: string } | undefined)?.name ?? "your pet";
  }
  return (pets as { name?: string }).name ?? "your pet";
}

async function alreadySentToday(
  supabase: ReturnType<typeof createClient>,
  clinicId: string,
  event: string,
  entityId: string,
  channel: "push" | "email" | "sms" | "whatsapp",
  recipientKey?: string | null,
) {
  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .gte("created_at", `${today}T00:00:00`)
    .lte("created_at", `${today}T23:59:59`)
    .eq("payload->>event", event)
    .eq("payload->>entity_id", entityId)
    .eq("channel", channel);
  if (recipientKey) query = query.eq("payload->>recipient_key", recipientKey);
  const { count } = await query;
  return (count ?? 0) > 0;
}

async function getOwnerEmail(
  supabase: ReturnType<typeof createClient>,
  ownerId: string | null
): Promise<string | null> {
  if (!ownerId) return null;
  const { data: owner } = await supabase.from("owners").select("email").eq("id", ownerId).maybeSingle();
  return owner?.email ?? null;
}

async function getClinicRoleEmails(
  supabase: ReturnType<typeof createClient>,
  clinicId: string,
  roles: string[],
): Promise<Array<{ user_id: string; email: string; role: string }>> {
  const { data: members, error: membersErr } = await supabase
    .from("user_clinic_memberships")
    .select("user_id, role")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .in("role", roles);
  if (membersErr || !members?.length) return [];

  const userIds = Array.from(new Set(members.map((m) => m.user_id).filter(Boolean)));
  if (!userIds.length) return [];

  const { data: users, error: usersErr } = await supabase
    .from("app_users")
    .select("id, email")
    .in("id", userIds)
    .not("email", "is", null);
  if (usersErr || !users?.length) return [];

  const emailByUser = new Map((users ?? []).map((u) => [u.id, u.email] as const));
  return (members ?? [])
    .map((m) => ({
      user_id: m.user_id,
      email: emailByUser.get(m.user_id) ?? "",
      role: m.role,
    }))
    .filter((r) => Boolean(r.email));
}

function previousMonthRange(now = new Date()): { startIso: string; endIso: string; monthKey: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    monthKey: start.toISOString().slice(0, 7),
  };
}

async function enqueueMonthlyTrafficDigest(
  supabase: ReturnType<typeof createClient>,
  clinicId: string,
  inserts: NotificationInsert[],
) {
  const now = new Date();
  // Generate on first 3 days of month (safer around cron gaps / deployment windows).
  if (now.getUTCDate() > 3) return;

  const { startIso, endIso, monthKey } = previousMonthRange(now);
  const recipients = await getClinicRoleEmails(supabase, clinicId, ["clinic_admin", "branch_admin", "receptionist"]);
  if (!recipients.length) return;

  const { count: totalViews } = await supabase
    .from("marketing_site_page_views")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  for (const recipient of recipients) {
    const recipientKey = `${monthKey}:${recipient.user_id}`;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("channel", "email")
      .eq("payload->>event", "monthly_traffic_digest")
      .eq("payload->>entity_id", monthKey)
      .eq("payload->>recipient_key", recipientKey);
    if ((count ?? 0) > 0) continue;

    inserts.push({
      clinic_id: clinicId,
      owner_id: null,
      user_id: recipient.user_id,
      channel: "email",
      title: `Website traffic report (${monthKey})`,
      message: `Public website traffic for ${monthKey}: ${totalViews ?? 0} visitor page views recorded.`,
      payload: {
        event: "monthly_traffic_digest",
        entity_id: monthKey,
        recipient_key: recipientKey,
        email: recipient.email,
      },
    });
  }
}

export async function runReminderGeneration() {
  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  let created = 0;
  const inserts: NotificationInsert[] = [];

  const next24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, starts_at, owner_id, owners(user_id, full_name), pets(name)")
    .eq("clinic_id", clinic_id)
    .eq("status", "scheduled")
    .gte("starts_at", now)
    .lte("starts_at", next24h)
    .limit(100);

  for (const appointment of appointments ?? []) {
    const seenPush = await alreadySentToday(supabase, clinic_id, "appointment_reminder", appointment.id, "push");
    const seenEmail = await alreadySentToday(supabase, clinic_id, "appointment_reminder", appointment.id, "email");
    const ownerEmail = await getOwnerEmail(supabase, appointment.owner_id);
    if (!seenPush) {
      inserts.push({
        clinic_id,
        owner_id: appointment.owner_id,
        user_id: (appointment.owners as { user_id?: string | null })?.user_id ?? null,
        channel: "push",
        title: "Appointment reminder",
        message: `Upcoming appointment for ${joinedPetName(appointment.pets)} at ${new Date(
          appointment.starts_at
        ).toLocaleString()}.`,
        payload: { event: "appointment_reminder", entity_id: appointment.id },
      });
    }
    if (!seenEmail && ownerEmail) {
      inserts.push({
        clinic_id,
        owner_id: appointment.owner_id,
        user_id: (appointment.owners as { user_id?: string | null })?.user_id ?? null,
        channel: "email",
        title: "Appointment reminder",
        message: `Upcoming appointment for ${joinedPetName(appointment.pets)} at ${new Date(
          appointment.starts_at
        ).toLocaleString()}.`,
        payload: { event: "appointment_reminder", entity_id: appointment.id, email: ownerEmail },
      });
    }

    const clinicRecipients = await getClinicRoleEmails(supabase, clinic_id, ["clinic_admin", "branch_admin", "receptionist"]);
    for (const recipient of clinicRecipients) {
      const recipientKey = `${appointment.id}:${recipient.user_id}`;
      const seenStaffEmail = await alreadySentToday(
        supabase,
        clinic_id,
        "appointment_reminder_staff",
        appointment.id,
        "email",
        recipientKey,
      );
      if (seenStaffEmail) continue;
      inserts.push({
        clinic_id,
        owner_id: appointment.owner_id,
        user_id: recipient.user_id,
        channel: "email",
        title: "Appointment reminder (clinic)",
        message: `Upcoming appointment for ${joinedPetName(appointment.pets)} at ${new Date(
          appointment.starts_at,
        ).toLocaleString()}.`,
        payload: {
          event: "appointment_reminder_staff",
          entity_id: appointment.id,
          recipient_key: recipientKey,
          role: recipient.role,
          email: recipient.email,
        },
      });
    }
  }

  const in3days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: vaccinations } = await supabase
    .from("vaccination_records")
    .select("id, due_on, owner_id: pets(owner_id), pets(name)")
    .eq("clinic_id", clinic_id)
    .not("due_on", "is", null)
    .lte("due_on", in3days)
    .limit(100);

  for (const record of vaccinations ?? []) {
    const entityId = record.id;
    const seenPush = await alreadySentToday(supabase, clinic_id, "vaccination_due", entityId, "push");
    const seenEmail = await alreadySentToday(supabase, clinic_id, "vaccination_due", entityId, "email");
    const ownerId = (record.owner_id as { owner_id?: string })?.owner_id ?? null;
    let userId: string | null = null;
    if (ownerId) {
      const { data: owner } = await supabase.from("owners").select("user_id").eq("id", ownerId).maybeSingle();
      userId = owner?.user_id ?? null;
    }
    const ownerEmail = await getOwnerEmail(supabase, ownerId);
    if (!seenPush) {
      inserts.push({
        clinic_id,
        owner_id: ownerId,
        user_id: userId,
        channel: "push",
        title: "Vaccination due soon",
        message: `${joinedPetName(record.pets)} has a vaccination due on ${record.due_on}.`,
        payload: { event: "vaccination_due", entity_id: entityId },
      });
    }
    if (!seenEmail && ownerEmail) {
      inserts.push({
        clinic_id,
        owner_id: ownerId,
        user_id: userId,
        channel: "email",
        title: "Vaccination due soon",
        message: `${joinedPetName(record.pets)} has a vaccination due on ${record.due_on}.`,
        payload: { event: "vaccination_due", entity_id: entityId, email: ownerEmail },
      });
    }
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, owner_id")
    .eq("clinic_id", clinic_id)
    .in("status", ["processing", "shipped", "delivered"])
    .limit(100);

  for (const order of orders ?? []) {
    const event = `order_${order.status}`;
    const seenPush = await alreadySentToday(supabase, clinic_id, event, order.id, "push");
    const seenEmail = await alreadySentToday(supabase, clinic_id, event, order.id, "email");
    let userId: string | null = null;
    if (order.owner_id) {
      const { data: owner } = await supabase.from("owners").select("user_id").eq("id", order.owner_id).maybeSingle();
      userId = owner?.user_id ?? null;
    }
    const ownerEmail = await getOwnerEmail(supabase, order.owner_id);
    if (!seenPush) {
      inserts.push({
        clinic_id,
        owner_id: order.owner_id,
        user_id: userId,
        channel: "push",
        title: "Order update",
        message: `Your order status is now ${order.status}.`,
        payload: { event, entity_id: order.id },
      });
    }
    if (!seenEmail && ownerEmail) {
      inserts.push({
        clinic_id,
        owner_id: order.owner_id,
        user_id: userId,
        channel: "email",
        title: "Order update",
        message: `Your order status is now ${order.status}.`,
        payload: { event, entity_id: order.id, email: ownerEmail },
      });
    }
  }

  await enqueueMonthlyTrafficDigest(supabase, clinic_id, inserts);

  if (inserts.length) {
    const { error } = await supabase.from("notifications").insert(inserts);
    if (error) throw new Error(error.message);
    created = inserts.length;
  }

  revalidatePath("/notifications-center");
  return created;
}

export async function dispatchPendingEmails() {
  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const branding = await getPlatformBranding();
  const brandName = branding.product_name || "GreenCoatVets";

  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!transporter || !from) {
    throw new Error("Missing Hostinger SMTP env vars.");
  }

  const { data: pending, error } = await supabase
    .from("notifications")
    .select("id, title, message, payload")
    .eq("clinic_id", clinic_id)
    .eq("channel", "email")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);

  let sent = 0;
  for (const item of pending ?? []) {
    const to = (item.payload as { email?: string })?.email;
    if (!to) continue;
    try {
      const mail = renderBrandedEmail({
        brandName,
        heading: item.title,
        intro: item.message,
        footer: `${brandName} automated notifications`,
      });
      await transporter.sendMail({
        from,
        to,
        subject: item.title,
        text: mail.text,
        html: mail.html,
      });
      await supabase.from("notifications").update({ sent_at: new Date().toISOString() }).eq("id", item.id);
      sent += 1;
    } catch {
      // Keep unsent for retry.
    }
  }

  revalidatePath("/notifications-center");
  return sent;
}

type SendTestEmailResult = { ok: true; sentTo: string; from: string } | { ok: false; error: string };

export async function sendNotificationTestEmailAction(formData: FormData): Promise<SendTestEmailResult> {
  const access = await getUserAccess();
  const role = access.membership?.role ?? null;
  const canSend = access.isSuperAdmin || role === "clinic_admin" || role === "branch_admin";
  if (!canSend) {
    return { ok: false, error: "Only admins can send SMTP test emails." };
  }

  const recipient = String(formData.get("recipient_email") ?? "")
    .trim()
    .toLowerCase();
  if (!recipient) {
    return { ok: false, error: "Recipient email is required." };
  }

  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!transporter || !from) {
    return { ok: false, error: "Hostinger SMTP is not configured yet." };
  }

  const { clinic_id } = await getActiveMembership();
  const sentAt = new Date();
  const branding = await getPlatformBranding();
  const brandName = branding.product_name || "GreenCoatVets";
  const mail = renderBrandedEmail({
    brandName,
    heading: "SMTP test email",
    intro: "This is a real test email sent from the web admin to confirm mail delivery is working.",
    details: [
      { label: "Clinic ID", value: clinic_id },
      { label: "Sent at", value: sentAt.toISOString() },
      { label: "SMTP host", value: process.env.HOSTINGER_SMTP_HOST ?? "smtp.hostinger.com" },
      { label: "From", value: from },
    ],
    footer: `${brandName} SMTP verification`,
  });

  try {
    await transporter.sendMail({
      from,
      to: recipient,
      subject: `${brandName} SMTP test email`,
      text: mail.text,
      html: mail.html,
    });

    return { ok: true, sentTo: recipient, from };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send the SMTP test email.",
    };
  }
}

/** Form actions — void return for `<form action={...}>`. */
export async function submitReminderGeneration() {
  await runReminderGeneration();
}

export async function submitDispatchPendingEmails() {
  await dispatchPendingEmails();
}
