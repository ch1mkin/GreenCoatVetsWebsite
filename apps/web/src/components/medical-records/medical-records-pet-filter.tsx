"use client";

import { useRouter } from "next/navigation";

export function MedicalRecordsPetFilter({
  pets,
  defaultPetId,
  activeTab,
}: {
  pets: { id: string; name: string }[];
  defaultPetId: string;
  activeTab?: string;
}) {
  const router = useRouter();

  return (
    <form
      className="relative mb-6 max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-outline-variant">
        search
      </span>
      <select
        className="input-soft w-full rounded-xl py-2.5 pl-12 pr-4 text-sm"
        name="pet"
        defaultValue={defaultPetId}
        onChange={(e) => {
          const pet = e.target.value;
          const params = new URLSearchParams();
          if (pet) params.set("pet", pet);
          if (activeTab && activeTab !== "records") params.set("tab", activeTab);
          const qs = params.toString();
          router.push(qs ? `/medical-records?${qs}` : "/medical-records");
        }}
      >
        <option value="">All pets</option>
        {pets.map((pet) => (
          <option key={pet.id} value={pet.id}>
            {pet.name}
          </option>
        ))}
      </select>
    </form>
  );
}
