import Link from "next/link";
import { redirect } from "next/navigation";
import { submitDispatchPendingEmails, submitReminderGeneration } from "./actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";

function payloadPreview(payload: unknown): string {
  if (payload == null) return "—";
  try {
    const s = JSON.stringify(payload);
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  } catch {
    return "—";
  }
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function channelBadgeClass(channel: string): string {
  switch (channel) {
    case "push":
      return "bg-primary-fixed text-primary";
    case "email":
      return "bg-secondary-container text-on-secondary-container";
    case "sms":
      return "bg-tertiary-fixed text-on-tertiary-fixed";
    case "whatsapp":
      return "bg-primary-container/30 text-on-primary-container";
    default:
      return "bg-surface-container text-on-surface-variant";
  }
}

function channelIconName(channel: string): string {
  switch (channel) {
    case "push":
      return "notifications_active";
    case "email":
      return "mail";
    case "sms":
      return "sms";
    case "whatsapp":
      return "chat";
    default:
      return "campaign";
  }
}

function channelShortLabel(channel: string): string {
  switch (channel) {
    case "push":
      return "Push";
    case "email":
      return "Email";
    case "sms":
      return "SMS";
    case "whatsapp":
      return "WhatsApp";
    default:
      return channel;
  }
}

export default async function NotificationsCenterPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");

  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const { clinic_id } = await getActiveMembership();

  const today = new Date().toISOString().slice(0, 10);
  const todayStart = `${today}T00:00:00`;

  const [
    notificationsRes,
    pendingEmailsRes,
    unreadRes,
    deliveredTodayRes,
    createdTodayRes,
    pendingEmailCountRes,
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, message, channel, sent_at, read_at, created_at, payload")
      .eq("clinic_id", clinic_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("notifications")
      .select("id, title, message, payload, created_at")
      .eq("clinic_id", clinic_id)
      .eq("channel", "email")
      .is("sent_at", null)
      .order("created_at", { ascending: true })
      .limit(25),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .is("read_at", null),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .eq("channel", "email")
      .not("sent_at", "is", null)
      .gte("sent_at", todayStart),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .gte("created_at", todayStart),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .eq("channel", "email")
      .is("sent_at", null),
  ]);

  if (notificationsRes.error) throw new Error(notificationsRes.error.message);
  if (pendingEmailsRes.error) throw new Error(pendingEmailsRes.error.message);

  const notifications = notificationsRes.data ?? [];
  const pendingEmails = pendingEmailsRes.data ?? [];
  const unreadCount = unreadRes.count ?? 0;
  const deliveredToday = deliveredTodayRes.count ?? 0;
  const createdToday = createdTodayRes.count ?? 0;
  const pendingEmailTotal = pendingEmailCountRes.count ?? 0;

  const smtpHost = process.env.HOSTINGER_SMTP_HOST ?? "smtp.hostinger.com";
  const queueDepthPct = Math.min(100, pendingEmailTotal === 0 ? 0 : Math.round((pendingEmailTotal / (pendingEmailTotal + 10)) * 100));

  const recentFeed = notifications.slice(0, 6);

  async function signOut() {
    "use server";
    const sb = createClient();
    await sb.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell
      title="Communication Hub"
      subtitle="Manage patient reminders, automated dispatches, and clinical outreach."
      activeHref="/notifications-center"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary" href="/dashboard">
            Dashboard
          </Link>
          <form action={signOut}>
            <button className="rounded-xl border border-outline-variant/30 px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low" type="submit">
              Sign out
            </button>
          </form>
        </div>
      }
    >
      <div className="mb-8 flex flex-wrap items-center justify-end gap-3">
        <form action={submitReminderGeneration}>
          <SubmitButton className="btn-primary flex items-center gap-2 rounded-xl px-6 py-3 shadow-lg">
            <span className="material-symbols-outlined text-xl">bolt</span>
            Run reminder generation
          </SubmitButton>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <section className="space-y-8 md:col-span-8">
          <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-sm sm:p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    campaign
                  </span>
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold">Recent notifications</h3>
                  <p className="text-sm text-on-surface-variant">Latest messages across channels</p>
                </div>
              </div>
              <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-secondary-container">
                {unreadCount} unread
              </span>
            </div>
            <div className="space-y-4">
              {notifications.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="group flex flex-col gap-4 rounded-2xl bg-surface-container-low p-5 transition-colors hover:bg-surface-container sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
                      <span className="material-symbols-outlined text-primary">{channelIconName(item.channel)}</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-on-background">{item.title}</h4>
                      <p className="line-clamp-2 text-xs text-on-surface-variant">{item.message}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end md:flex-row">
                    <span className="text-xs font-medium text-on-surface-variant">{relativeTime(item.created_at)}</span>
                    <div
                      className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${channelBadgeClass(item.channel)}`}
                    >
                      {channelShortLabel(item.channel)}
                    </div>
                  </div>
                </div>
              ))}
              {!notifications.length ? (
                <p className="text-sm text-on-surface-variant">No notifications yet — run reminder generation to populate.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl bg-surface-container-low p-6 sm:p-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    mail
                  </span>
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold">Email dispatch queue</h3>
                  <p className="text-sm text-on-surface-variant">
                    Hostinger SMTP: <span className="font-semibold text-primary">{smtpHost}</span>
                  </p>
                </div>
              </div>
              <form action={submitDispatchPendingEmails}>
                <SubmitButton className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition-all hover:bg-white active:scale-95">
                  <span className="material-symbols-outlined text-base">send</span>
                  Send pending emails
                </SubmitButton>
              </form>
            </div>
            <div className="overflow-hidden rounded-2xl bg-white/50">
              <table className="w-full border-collapse text-left">
                <thead className="bg-surface-container-highest/20 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3 sm:px-6">Recipient</th>
                    <th className="px-4 py-3 sm:px-6">Subject</th>
                    <th className="hidden px-4 py-3 sm:table-cell sm:px-6">Queued</th>
                    <th className="px-4 py-3 text-right sm:px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {pendingEmails.map((row) => {
                    const email = (row.payload as { email?: string })?.email ?? "—";
                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-4 sm:px-6">
                          <div className="text-sm font-medium">{email}</div>
                          <div className="text-[10px] text-on-surface-variant">ID: {row.id.slice(0, 8)}…</div>
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-4 text-sm sm:max-w-none sm:px-6">{row.title}</td>
                        <td className="hidden px-4 py-4 text-xs text-on-surface-variant sm:table-cell sm:px-6">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-right sm:px-6">
                          <span className="flex items-center justify-end gap-1 text-xs font-bold text-primary">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                            Queued
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!pendingEmails.length ? (
                <p className="px-6 py-6 text-sm text-on-surface-variant">No pending outbound emails.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
            <h3 className="font-headline text-lg font-bold">Full log</h3>
            <p className="mt-1 text-sm text-on-surface-variant">All channels (up to 100 rows)</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Channel</th>
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Message</th>
                    <th className="py-2">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((item) => (
                    <tr className="border-b border-outline-variant/10" key={item.id}>
                      <td className="py-2 align-top text-xs">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="py-2 align-top">{item.channel}</td>
                      <td className="py-2 align-top">{item.title}</td>
                      <td className="max-w-xs py-2 align-top text-xs">{item.message}</td>
                      <td className="py-2 align-top text-xs text-on-surface-variant">{payloadPreview(item.payload)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!notifications.length ? <p className="pt-3 text-sm text-on-surface-variant">No rows.</p> : null}
            </div>
          </div>
        </section>

        <aside className="space-y-8 md:col-span-4">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-on-primary-fixed-variant p-8 text-white">
            <h3 className="font-headline mb-6 text-lg font-bold">Dispatch status</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm opacity-80">Email queue depth</span>
                <span className="text-sm font-bold">{pendingEmailTotal}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full bg-primary-fixed" style={{ width: `${queueDepthPct}%` }} />
              </div>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex-1 rounded-2xl bg-white/10 p-3">
                  <div className="mb-1 text-[10px] font-bold uppercase opacity-60">Emails sent today</div>
                  <div className="font-headline text-2xl font-bold">{deliveredToday}</div>
                </div>
                <div className="flex-1 rounded-2xl bg-white/10 p-3">
                  <div className="mb-1 text-[10px] font-bold uppercase opacity-60">Notifications created today</div>
                  <div className="font-headline text-2xl font-bold">{createdToday}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-surface-container-lowest p-8 shadow-sm">
            <h3 className="font-headline mb-6 text-lg font-bold">Recent history</h3>
            <div className="relative space-y-8 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-outline-variant/20">
              {recentFeed.map((item) => {
                const isEmail = item.channel === "email";
                return (
                  <div className="relative pl-10" key={item.id}>
                    <div
                      className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full ${
                        isEmail ? "bg-surface-container-high" : "bg-primary-fixed"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[14px] ${isEmail ? "text-on-surface-variant" : "text-primary"}`}
                        style={isEmail ? undefined : { fontVariationSettings: "'FILL' 1" }}
                      >
                        {isEmail ? "mail" : "check_circle"}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-on-background">{item.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-on-surface-variant">{item.message}</div>
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant italic">
                      {relativeTime(item.created_at)} · {channelShortLabel(item.channel)}
                    </div>
                  </div>
                );
              })}
              {!recentFeed.length ? <p className="text-sm text-on-surface-variant">No activity yet.</p> : null}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
