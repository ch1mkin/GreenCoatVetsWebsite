export type VisitAppointmentContextProps = {
  petName: string;
  species: string;
  ownerName: string;
  doctorName: string;
  branchName: string;
  appointmentStatus: string;
  appointmentReason: string;
  appointmentNotes: string;
  appointmentStartsAt: string | null;
  chiefComplaint: string;
  allergies: string;
  currentMedications: string;
  contactPhone: string;
  contactEmail: string;
};

export function VisitAppointmentContext({ context }: { context: VisitAppointmentContextProps }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-[13px] text-slate-800">
      <p className="font-headline text-sm font-bold text-slate-900">Appointment details</p>
      <p className="mt-1 text-[11px] text-slate-600">
        Use this while writing on the paper sheet so you do not need to switch tabs.
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <p>
          <span className="text-slate-500">Patient:</span> <strong>{context.petName}</strong> ({context.species})
        </p>
        <p>
          <span className="text-slate-500">Owner:</span> <strong>{context.ownerName}</strong>
        </p>
        <p>
          <span className="text-slate-500">Doctor:</span> {context.doctorName}
        </p>
        <p>
          <span className="text-slate-500">Branch:</span> {context.branchName}
        </p>
        <p>
          <span className="text-slate-500">Status:</span> {context.appointmentStatus}
        </p>
        <p>
          <span className="text-slate-500">Scheduled:</span> {context.appointmentStartsAt ?? "—"}
        </p>
        <p className="md:col-span-2">
          <span className="text-slate-500">Reason:</span> {context.appointmentReason || "—"}
        </p>
        {context.chiefComplaint ? (
          <p className="md:col-span-2">
            <span className="text-slate-500">Chief complaint:</span> {context.chiefComplaint}
          </p>
        ) : null}
        {context.appointmentNotes ? (
          <p className="md:col-span-2">
            <span className="text-slate-500">Booking notes:</span> {context.appointmentNotes}
          </p>
        ) : null}
        {context.allergies ? (
          <p className="md:col-span-2">
            <span className="text-slate-500">Allergies:</span> {context.allergies}
          </p>
        ) : null}
        {context.currentMedications ? (
          <p className="md:col-span-2">
            <span className="text-slate-500">Current medications:</span> {context.currentMedications}
          </p>
        ) : null}
        {context.contactPhone ? (
          <p>
            <span className="text-slate-500">Phone:</span> {context.contactPhone}
          </p>
        ) : null}
        {context.contactEmail ? (
          <p>
            <span className="text-slate-500">Email:</span> {context.contactEmail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
