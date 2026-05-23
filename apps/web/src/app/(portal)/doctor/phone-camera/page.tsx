import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/web/app-shell";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups } from "@/lib/auth/permissions";

export const metadata = {
  title: "Phone camera",
};

export default async function DoctorPhoneCameraPage() {
  const access = await getUserAccess();
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];

  const allowed =
    access.isSuperAdmin || role === "doctor" || role === "clinic_admin" || role === "branch_admin";
  if (!allowed) {
    redirect("/dashboard");
  }

  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);

  return (
    <AppShell
      title="Phone camera for visits"
      subtitle="Pair your phone with an open visit on your laptop"
      activeHref="/doctor/phone-camera"
      navGroups={navGroups}
    >
      <div className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-primary">How it works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-on-surface-variant">
          <li>Open a visit on your laptop (from Appointments → Start consultation, or Medical records).</li>
          <li>Select the <strong>Photo sheet</strong> documentation method on the visit.</li>
          <li>Scan the QR with your phone, take a photo of the handwritten sheet, and wait for the scan preview on the laptop.</li>
          <li>Tap <strong>Save as visit PDF</strong> when the enhanced preview looks correct.</li>
        </ol>
        <p className="text-sm text-on-surface-variant">
          QR links expire after four hours. Start a new QR from the visit if you return later.
        </p>
        <Link href="/appointments" className="btn-primary inline-flex">
          Go to appointments
        </Link>
      </div>
    </AppShell>
  );
}
