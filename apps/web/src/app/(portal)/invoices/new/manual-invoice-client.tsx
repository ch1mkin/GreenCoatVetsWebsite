"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createManualInvoice, type ManualInvoicePayload } from "@/app/(portal)/invoicing/actions";

export type InvoiceDraftLine = {
  key: string;
  line_type: "medicine" | "lab_test" | "service" | "custom";
  description: string;
  quantity: number;
  unit_price: number;
};

function newKey() {
  return `line-${crypto.randomUUID().slice(0, 8)}`;
}

type Props = {
  branches: { id: string; name: string }[];
  owners: { id: string; label: string }[];
};

export function ManualInvoiceClient({ branches, owners }: Props) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");
  const [patientName, setPatientName] = useState("");
  const [lines, setLines] = useState<InvoiceDraftLine[]>([
    { key: newKey(), line_type: "custom", description: "", quantity: 1, unit_price: 0 },
  ]);
  const [taxRate, setTaxRate] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const updateLine = (key: string, patch: Partial<InvoiceDraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { key: newKey(), line_type: "custom", description: "", quantity: 1, unit_price: 0 },
    ]);
  };

  const submit = () => {
    setError(null);
    if (!branchId || !ownerId) {
      setError("Choose a branch and owner.");
      return;
    }
    startTransition(async () => {
      try {
        const tr = taxRate.trim() === "" ? null : Number(taxRate);
        const disc = discount.trim() === "" ? 0 : Number(discount);
        const payload: ManualInvoicePayload = {
          branch_id: branchId,
          owner_id: ownerId,
          patient_name: patientName.trim() || "—",
          tax_rate: tr != null && !Number.isNaN(tr) ? tr : null,
          discount_total: Number.isNaN(disc) ? 0 : disc,
          notes,
          lines: lines.map((l) => ({
            line_type: l.line_type,
            prescription_item_id: null,
            test_code: null,
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
        };
        await createManualInvoice(payload);
        router.push("/invoices");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create invoice.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-on-surface-variant">Branch</span>
          <select className="input-soft" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-on-surface-variant">Owner (client)</span>
          <select className="input-soft" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-semibold text-on-surface-variant">Patient name</span>
          <input
            className="input-soft"
            placeholder="e.g. Bruno"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-md border border-outline-variant/25 bg-surface-container-lowest/50">
        <table className="pms-table min-w-[720px]">
          <thead>
            <tr>
              <th>Description</th>
              <th className="w-20">Qty</th>
              <th className="w-28">Unit (INR)</th>
              <th className="w-28">Line total</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
              const unit = Math.max(0, Number(line.unit_price) || 0);
              const lineTotal = Math.round(qty * unit * 100) / 100;
              return (
                <tr key={line.key}>
                  <td className="align-top">
                    <textarea
                      className="input-soft min-h-[52px] w-full py-2 text-sm"
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                    />
                  </td>
                  <td className="align-top">
                    <input
                      className="input-soft w-full py-1.5 text-sm"
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                    />
                  </td>
                  <td className="align-top">
                    <input
                      className="input-soft w-full py-1.5 text-sm"
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unit_price}
                      onChange={(e) => updateLine(line.key, { unit_price: Number(e.target.value) })}
                    />
                  </td>
                  <td className="align-middle text-sm font-semibold tabular-nums">{lineTotal.toFixed(2)}</td>
                  <td className="align-top">
                    <button
                      type="button"
                      className="text-on-surface-variant hover:text-error"
                      onClick={() => removeLine(line.key)}
                      aria-label="Remove line"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn-secondary text-sm" onClick={addLine}>
        Add line
      </button>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-on-surface-variant">Tax rate (%)</span>
          <input
            className="input-soft"
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-on-surface-variant">Discount (INR)</span>
          <input
            className="input-soft"
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-semibold text-on-surface-variant">Invoice notes (optional)</span>
          <textarea className="input-soft min-h-[72px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <button type="button" className="btn-primary" disabled={pending} onClick={submit}>
        {pending ? "Saving invoice & PDF…" : "Create manual invoice"}
      </button>
    </div>
  );
}
