export type RecordTabEntry = {
  id: string;
  label: string;
  href: string;
  kind: "patient" | "contact";
};

export type NavHistoryEntry = {
  href: string;
  label: string;
  kind: "patient" | "contact";
  at: number;
};
