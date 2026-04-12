import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { getFaviconHref, getPlatformBranding } from "@/lib/platform-branding";

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
  const icon = getFaviconHref(branding);
  return {
    title: { default: title, template: `%s · ${branding.product_name}` },
    description: "Veterinary clinic operations — appointments, records, pharmacy, and payments.",
    icons: {
      icon: [
        ...(icon ? [{ url: icon, type: "image/png" as const }] : []),
        { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      ],
      apple: icon ? [{ url: icon }] : [{ url: "/favicon.svg", type: "image/svg+xml" }],
    },
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
