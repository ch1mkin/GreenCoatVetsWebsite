import type { Metadata } from "next";

export function clinicMetadata(input: {
  clinicName: string;
  title: string;
  description: string;
  path?: string;
}): Metadata {
  const { clinicName, title, description, path = "/" } = input;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      siteName: clinicName,
      type: "website",
      url: path,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}
