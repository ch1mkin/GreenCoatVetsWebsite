import { Appointment } from "../types/app";

/** Supabase FK embeds sometimes arrive as a single object or a one-element array */
export function normalizeAppointment(row: unknown): Appointment {
  const a = row as Record<string, unknown>;
  const branches = a.branches as Appointment["branches"];
  const pets = a.pets as Appointment["pets"];
  const owners = a.owners as Appointment["owners"];
  return {
    ...(a as Appointment),
    branches: Array.isArray(branches) ? branches[0] ?? null : branches ?? null,
    pets: Array.isArray(pets) ? pets[0] ?? null : pets ?? null,
    owners: Array.isArray(owners) ? owners[0] ?? null : owners ?? null,
  };
}
