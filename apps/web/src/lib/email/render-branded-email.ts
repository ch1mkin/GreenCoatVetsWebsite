type EmailDetail = {
  label: string;
  value: string;
};

export type EmailCta = {
  label: string;
  href: string;
};

type BrandedEmailInput = {
  brandName: string;
  heading: string;
  intro?: string;
  body?: string[];
  details?: EmailDetail[];
  bullets?: string[];
  /** @deprecated Prefer `ctas` for one or more action buttons. */
  ctaLabel?: string;
  /** @deprecated Prefer `ctas` for one or more action buttons. */
  ctaHref?: string;
  ctas?: EmailCta[];
  footer?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveCtas(input: BrandedEmailInput): EmailCta[] {
  if (input.ctas?.length) {
    return input.ctas.filter((cta) => cta.label.trim() && cta.href.trim());
  }
  if (input.ctaLabel?.trim() && input.ctaHref?.trim()) {
    return [{ label: input.ctaLabel.trim(), href: input.ctaHref.trim() }];
  }
  return [];
}

function renderEmailButtons(ctas: EmailCta[]): string {
  return ctas
    .map(
      (cta) => `
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 12px;">
          <tr>
            <td align="center" style="border-radius:999px;background:#0d8b68;">
              <a href="${escapeHtml(cta.href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;border-radius:999px;padding:14px 24px;font-size:14px;font-weight:700;line-height:1.2;color:#ffffff;text-decoration:none;">
                ${escapeHtml(cta.label)}
              </a>
            </td>
          </tr>
        </table>
      `,
    )
    .join("");
}

export function renderBrandedEmail(input: BrandedEmailInput): { html: string; text: string } {
  const intro = input.intro?.trim() || "";
  const body = (input.body ?? []).map((item) => item.trim()).filter(Boolean);
  const details = (input.details ?? []).filter((item) => item.label.trim() && item.value.trim());
  const bullets = (input.bullets ?? []).map((item) => item.trim()).filter(Boolean);
  const footer = input.footer?.trim() || `Sent by ${input.brandName}`;
  const ctas = resolveCtas(input);

  const html = `
    <div style="margin:0;background:#f4f8f6;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#16312b;">
      <div style="margin:0 auto;max-width:640px;overflow:hidden;border-radius:24px;background:#ffffff;border:1px solid #dce9e3;">
        <div style="background:linear-gradient(135deg,#0d8b68,#084f3b);padding:28px 32px;color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;opacity:0.9;">${escapeHtml(input.brandName)}</div>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;font-weight:800;">${escapeHtml(input.heading)}</h1>
        </div>
        <div style="padding:28px 32px;">
          ${intro ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#38534b;">${escapeHtml(intro)}</p>` : ""}
          ${body
            .map((paragraph) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#16312b;">${escapeHtml(paragraph)}</p>`)
            .join("")}
          ${
            details.length
              ? `
                <div style="margin:24px 0;padding:18px 20px;border-radius:18px;background:#f7fbf9;border:1px solid #dce9e3;">
                  ${details
                    .map(
                      (item) => `
                        <div style="padding:8px 0;border-bottom:1px solid #e4efea;">
                          <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5f6f68;">${escapeHtml(item.label)}</div>
                          <div style="margin-top:4px;font-size:15px;line-height:1.65;color:#16312b;">${escapeHtml(item.value)}</div>
                        </div>
                      `,
                    )
                    .join("")}
                </div>
              `
              : ""
          }
          ${
            bullets.length
              ? `
                <ul style="margin:20px 0;padding-left:20px;color:#16312b;">
                  ${bullets.map((item) => `<li style="margin:0 0 10px;line-height:1.7;">${escapeHtml(item)}</li>`).join("")}
                </ul>
              `
              : ""
          }
          ${ctas.length ? `<div style="margin-top:28px;">${renderEmailButtons(ctas)}</div>` : ""}
        </div>
        <div style="padding:18px 32px;border-top:1px solid #e4efea;font-size:12px;line-height:1.6;color:#5f6f68;background:#fbfdfc;">
          ${escapeHtml(footer)}
        </div>
      </div>
    </div>
  `.trim();

  const text = [
    input.brandName,
    input.heading,
    "",
    intro,
    ...body,
    details.length
      ? [
          "",
          ...details.flatMap((item) => [`${item.label}: ${item.value}`]),
        ].join("\n")
      : "",
    bullets.length
      ? [
          "",
          ...bullets.map((item) => `- ${item}`),
        ].join("\n")
      : "",
    ctas.length
      ? [
          "",
          "Actions:",
          ...ctas.map((cta) => `→ ${cta.label}`),
        ].join("\n")
      : "",
    "",
    footer,
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}
