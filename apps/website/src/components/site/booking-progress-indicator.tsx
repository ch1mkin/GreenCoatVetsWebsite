"use client";

import { useEffect, useMemo, useState } from "react";

type StepState = {
  details: boolean;
  vetPet: boolean;
  time: boolean;
};

function readStepState(): StepState {
  const branch = (document.querySelector('select[name="branch_id"]') as HTMLSelectElement | null)?.value?.trim() ?? "";
  const pet = (document.querySelector('select[name="pet_id"]') as HTMLSelectElement | null)?.value?.trim() ?? "";
  const petName = (document.querySelector('input[name="pet_name"]') as HTMLInputElement | null)?.value?.trim() ?? "";
  const newPetName = (document.querySelector('input[name="new_pet_name"]') as HTMLInputElement | null)?.value?.trim() ?? "";
  const startsAt = (document.querySelector('input[name="starts_at"]') as HTMLInputElement | null)?.value?.trim() ?? "";
  return {
    details: branch.length > 0,
    vetPet: pet.length > 0 || petName.length > 0 || newPetName.length > 0,
    time: startsAt.length > 0,
  };
}

export function BookingProgressIndicator() {
  const [state, setState] = useState<StepState>({ details: false, vetPet: false, time: false });

  useEffect(() => {
    const update = () => setState(readStepState());
    update();
    const form = document.querySelector("form[data-booking-form]");
    if (!form) return;
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
    };
  }, []);

  const current = useMemo(() => {
    if (!state.details) return 0;
    if (!state.vetPet) return 1;
    if (!state.time) return 2;
    return 3;
  }, [state]);

  const done = [state.details, state.vetPet, state.time, state.details && state.vetPet && state.time];
  const labels = ["Branch", "Pet", "Time", "Confirm"];

  return (
    <div className="relative flex items-center justify-between">
      <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-full -translate-y-1/2 bg-surface-container" />
      {labels.map((label, i) => {
        const active = i === current;
        const complete = done[i];
        return (
          <div key={label} className="flex flex-col items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-4 ring-surface ${
                complete || active ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-[10px] font-semibold sm:text-xs ${complete || active ? "text-primary" : "text-on-surface-variant"}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
