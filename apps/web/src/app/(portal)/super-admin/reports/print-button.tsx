"use client";

export function PrintButton() {
  return (
    <button
      className="btn-primary px-4 py-2.5 text-sm shadow-md transition-opacity hover:opacity-95"
      onClick={() => window.print()}
      type="button"
    >
      Export / Print PDF
    </button>
  );
}
