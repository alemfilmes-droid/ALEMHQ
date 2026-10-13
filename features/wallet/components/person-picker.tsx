"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

/** Para quem pode ver a Carteira dos outros (master, admin, diretoria, financeiro). */
export function PersonPicker({ people, current }: { people: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  return (
    <label className="flex flex-col gap-1 text-[13px] font-semibold sm:w-72">
      Ver a Carteira de
      <NativeSelect className="min-h-11" value={current} onChange={(event) => router.push(`/carteira?pessoa=${event.target.value}`)}>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
