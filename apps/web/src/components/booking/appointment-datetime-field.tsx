"use client";

import { getMinAppointmentDateTimeLocalValue } from "@saasclinics/lib";
import { useMemo } from "react";

type Props = {
  name?: string;
  required?: boolean;
  className?: string;
  defaultValue?: string;
};

export function AppointmentDateTimeField({
  name = "starts_at",
  required = true,
  className,
  defaultValue,
}: Props) {
  const min = useMemo(() => getMinAppointmentDateTimeLocalValue(), []);

  return (
    <input
      className={className}
      type="datetime-local"
      name={name}
      required={required}
      min={min}
      defaultValue={defaultValue}
    />
  );
}
