"use client";

import { useCrm } from "@/components/crm/crm-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Función sugerida al vincular por teléfono. */
export const DEFAULT_ROLE_NAME = "Contacto principal";

/** Id de la función sugerida (o ninguna si se renombró o borró). */
export function useDefaultRoleIds(): string[] {
  const { roles } = useCrm();
  const role = roles.find((r) => r.name === DEFAULT_ROLE_NAME);
  return role ? [role.id] : [];
}

/** Selección múltiple de funciones del catálogo (para el vínculo persona–empresa). */
export function RolesPicker({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}) {
  const { roles } = useCrm();
  const selected = new Set(value);
  return (
    <fieldset className={cn("space-y-1.5", className)}>
      <legend className="mb-1 text-xs font-medium text-texto-suave">Funciones en la empresa</legend>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {roles.map((role) => (
          <label key={role.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-superficie-2">
            <Checkbox
              checked={selected.has(role.id)}
              onCheckedChange={(checked) =>
                onChange(checked === true ? [...value, role.id] : value.filter((id) => id !== role.id))
              }
            />
            {role.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
