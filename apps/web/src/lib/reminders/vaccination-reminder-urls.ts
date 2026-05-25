const DEFAULT_WEBSITE = "https://www.greencoatvets.com";

export function vaccinationReminderUrls(token: string) {
  const base = (process.env.NEXT_PUBLIC_WEBSITE_APP_URL ?? DEFAULT_WEBSITE).replace(/\/$/, "");
  const q = encodeURIComponent(token);
  return {
    respondPage: `${base}/reminders/vaccination?token=${q}`,
    completed: `${base}/reminders/vaccination?token=${q}&action=completed`,
    notDone: `${base}/reminders/vaccination?token=${q}&action=not_done`,
    optOut: `${base}/reminders/vaccination?token=${q}&action=opt_out`,
  };
}
