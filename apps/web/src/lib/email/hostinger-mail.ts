import nodemailer from "nodemailer";

export function createHostingerTransport() {
  const host = process.env.HOSTINGER_SMTP_HOST;
  const port = Number(process.env.HOSTINGER_SMTP_PORT ?? "465");
  const user = process.env.HOSTINGER_SMTP_USER;
  const pass = process.env.HOSTINGER_SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function getHostingerFromAddress(): string | null {
  const from = process.env.HOSTINGER_SMTP_FROM?.trim();
  const user = process.env.HOSTINGER_SMTP_USER?.trim();
  return from || user || null;
}
