import { VisitCaptureClient } from "./visit-capture-client";

export const metadata = {
  title: "Visit photo capture",
  robots: { index: false, follow: false },
};

export default async function VisitCapturePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <VisitCaptureClient token={token} />;
}
