"use client";

import { useState, type ReactNode } from "react";

export function AppointmentsAdminDangerZone({
  userEmail,
  websiteBookingCount,
  websiteOwnerPurgeCount,
  websitePetPurgeCount,
  appointmentsCleanup,
  ownersPetsCleanup,
}: {
  userEmail: string;
  websiteBookingCount: number;
  websiteOwnerPurgeCount: number;
  websitePetPurgeCount: number;
  appointmentsCleanup: ReactNode;
  ownersPetsCleanup: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-6 card-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-lg font-bold">Advanced admin tools</h2>
          <p className="mt-1 text-sm text-slate-600">
            Destructive cleanup for website test data. Hidden by default so routine scheduling stays uncluttered.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Hide admin tools" : "Show admin tools"}
        </button>
      </div>

      {open ? (
        <div className="mt-4 space-y-6 border-t border-slate-200 pt-4">
          <div>
            <h3 className="font-headline text-base font-bold">Website booking cleanup</h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete the current clinic&apos;s existing website-booked appointments after confirming with a code sent to{" "}
              <strong>{userEmail}</strong>. New bookings created after the code is sent are not included.
            </p>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Existing website-booked appointments in this clinic: <strong>{websiteBookingCount}</strong>
            </div>
            <div className="mt-4">{appointmentsCleanup}</div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-headline text-base font-bold">Website owner and patient cleanup</h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete eligible website-created test owners and patients after confirming with a code sent to{" "}
              <strong>{userEmail}</strong>. The cleanup excludes that admin email and only targets conservative website-origin
              records that do not already show clinic-side activity.
            </p>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Eligible website-created owners: <strong>{websiteOwnerPurgeCount}</strong>
              <span className="mx-2 text-amber-700">|</span>
              Eligible website-created patients: <strong>{websitePetPurgeCount}</strong>
            </div>
            <div className="mt-4">{ownersPetsCleanup}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
