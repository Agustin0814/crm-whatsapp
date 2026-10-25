import { toast } from "sonner";
import { findContactByPhone } from "@/lib/crm/contacts";
import type { createClient } from "@/lib/supabase/client";

/**
 * Teléfono repetido (índice único sobre el número normalizado): avisa en
 * español con un botón para abrir el contacto que ya lo tiene.
 */
export async function notifyDuplicatePhone(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  navigate: (href: string) => void,
  excludeId?: string,
): Promise<void> {
  const existing = await findContactByPhone(supabase, phone, excludeId);
  if (!existing) {
    toast.error("Ese teléfono ya pertenece a otro contacto. Si es un fijo compartido, regístralo en la empresa.");
    return;
  }
  toast.error(`Ese teléfono ya es de «${existing.name || "un contacto sin nombre"}».`, {
    description: "No se repiten teléfonos entre personas. Si es un fijo compartido, va en la empresa.",
    action: { label: "Ver contacto", onClick: () => navigate(`/contactos/persona/${existing.id}`) },
    duration: 10_000,
  });
}
