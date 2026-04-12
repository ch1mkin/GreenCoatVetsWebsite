/** Maps DB appointment_type enum to display + Tailwind classes (design tokens). */

export function appointmentTypeLabel(type: string): string {
  switch (type) {
    case "consultation":
      return "Standard checkup";
    case "vaccination":
      return "Vaccination";
    case "surgery":
      return "Surgery";
    case "grooming":
      return "Grooming";
    case "emergency":
      return "Urgent care";
    default:
      return type;
  }
}

export function appointmentBlockClasses(type: string): string {
  switch (type) {
    case "consultation":
      return "bg-primary-container text-on-primary-container border border-primary/20";
    case "vaccination":
      return "bg-primary-fixed text-on-primary-fixed-variant border border-primary-fixed/30";
    case "surgery":
      return "bg-secondary text-on-secondary border border-secondary/30";
    case "grooming":
      return "bg-secondary-container text-on-secondary-container border border-outline-variant/40";
    case "emergency":
      return "bg-tertiary-fixed-dim text-on-tertiary-fixed border border-tertiary/30";
    default:
      return "bg-surface-container-highest text-on-surface border border-outline-variant/40";
  }
}

export function legendDotClass(type: string): string {
  switch (type) {
    case "consultation":
      return "bg-primary-container";
    case "vaccination":
      return "bg-primary-fixed";
    case "surgery":
      return "bg-secondary";
    case "grooming":
      return "bg-secondary-container";
    case "emergency":
      return "bg-tertiary-fixed-dim";
    default:
      return "bg-outline";
  }
}
