import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { buildPlatformIcons, resolveFaviconUrl } from "@saasclinics/lib";
import { getPlatformBranding } from "@/lib/platform-branding";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding();
  const title = `${branding.product_name} — Clinic Software`;
  const metadataBase = new URL(
    (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  );
  return {
    metadataBase,
    title: { default: title, template: `%s · ${branding.product_name}` },
    description: "Veterinary clinic operations — appointments, records, pharmacy, and payments.",
    icons: buildPlatformIcons(resolveFaviconUrl(branding)),
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${manrope.variable} bg-surface text-on-background antialiased`}>
        {children}
      </body>
    </html>
  );
}
