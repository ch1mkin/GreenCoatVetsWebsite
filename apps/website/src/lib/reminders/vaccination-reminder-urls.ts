import { getWebsitePublicBaseUrl } from "@/lib/seo/public-site-url";

export function vaccinationReminderUrls(token: string) {
  const base = getWebsitePublicBaseUrl();
  const q = encodeURIComponent(token);
  return {
    respondPage: `${base}/reminders/vaccination?token=${q}`,
    completed: `${base}/reminders/vaccination?token=${q}&action=completed`,
    notDone: `${base}/reminders/vaccination?token=${q}&action=not_done`,
    optOut: `${base}/reminders/vaccination?token=${q}&action=opt_out`,
  };
}
