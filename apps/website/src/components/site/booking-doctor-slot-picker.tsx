"use client";

import { useCallback, useEffect, useState } from "react";
import { AppointmentDateTimeField } from "@/components/site/appointment-datetime-field";

type Doctor = { id: string; full_name: string; branch_id: string | null };
type Slot = { starts_at: string; ends_at: string; label: string };

type Props = {
  clinicId: string;
  doctors: Doctor[];
  fieldClassName: string;
  optionalDoctor?: boolean;
};

function readFormBranchId(): string {
  if (typeof document === "undefined") return "";
  const el = document.querySelector<HTMLSelectElement>('form[data-booking-form] select[name="branch_id"]');
  return el?.value?.trim() ?? "";
}

export function BookingDoctorSlotPicker({ clinicId, doctors, fieldClassName, optionalDoctor = false }: Props) {
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [branchTick, setBranchTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = document.querySelector<HTMLSelectElement>('form[data-booking-form] select[name="branch_id"]');
    const onChange = () => setBranchTick((n) => n + 1);
    el?.addEventListener("change", onChange);
    return () => el?.removeEventListener("change", onChange);
  }, []);

  const branchId = readFormBranchId();
  void branchTick;
  const filteredDoctors = doctors.filter((d) => !branchId || !d.branch_id || d.branch_id === branchId);

  const loadSlots = useCallback(async () => {
    if (!doctorId || !date) {
      setSlots([]);
      return;
    }
    const branch = readFormBranchId();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        clinic_id: clinicId,
        doctor_id: doctorId,
        date,
      });
      if (branch) params.set("branch_id", branch);
      const res = await fetch(`/api/booking/slots?${params.toString()}`);
      const json = (await res.json()) as { slots?: Slot[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not load slots");
      const list = Array.isArray(json.slots) ? json.slots : [];
      setSlots(list);
      if (!list.some((s) => s.starts_at === startsAt)) setStartsAt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load slots");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId, date, doctorId, startsAt]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  if (!doctors.length) return null;

  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4 sm:col-span-2">
      <p className="text-sm text-on-surface-variant">
        Choose a doctor and an available time slot. Slots reflect clinic schedules and existing bookings.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Doctor</label>
          <select
            className={fieldClassName}
            name="doctor_id"
            value={doctorId}
            onChange={(e) => {
              setDoctorId(e.target.value);
              setStartsAt("");
            }}
            required={!optionalDoctor}
          >
            <option value="">{optionalDoctor ? "Any available clinician" : "Select doctor"}</option>
            {filteredDoctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Date</label>
          <input
            className={fieldClassName}
            type="date"
            min={minDate}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setStartsAt("");
            }}
            required={Boolean(doctorId)}
          />
        </div>
      </div>
      {doctorId && date ? (
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Time slot</label>
          {loading ? (
            <p className="text-sm text-on-surface-variant">Loading available times…</p>
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No open slots this day. Try another date or doctor.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.starts_at}
                  type="button"
                  onClick={() => setStartsAt(slot.starts_at)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                    startsAt === slot.starts_at
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant/40 bg-surface-container-low text-on-surface hover:border-primary/40"
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          )}
          <input type="hidden" name="starts_at" value={startsAt} required={Boolean(doctorId)} />
        </div>
      ) : optionalDoctor ? (
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Date &amp; time</label>
          <AppointmentDateTimeField className={fieldClassName} />
        </div>
      ) : (
        <input type="hidden" name="starts_at" value="" />
      )}
      {/* branch_id sync for parent form — parent passes branch select name="branch_id" */}
    </div>
  );
}
