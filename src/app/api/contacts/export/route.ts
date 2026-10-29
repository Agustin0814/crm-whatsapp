import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/crm/csv";
import { isContactSource, SOURCE_LABELS } from "@/lib/crm/message-data";
import { CLASSIFICATION_LABELS, isClassification } from "@/lib/crm/types";
import { formatPhone } from "@/lib/format";

// Exporta las personas a CSV (solo administrador y superadmin). Lee con la
// SESIÓN del administrador (RLS): nunca incluye lo que su rol no puede ver.
// Deja registro en contact_exports (quién, cuándo y cuántas filas).

const MAX_ROWS = 20_000;

function day(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("es-MX", { timeZone: "America/Hermosillo" }) : "";
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { supabase } = check;

  const { data, error } = await supabase
    .from("contacts")
    .select("name, phone, wa_id, classification, delivery_address, delivery_references, source, last_purchase_at, created_at, contact_tags(tags(name))")
    .order("created_at")
    .limit(MAX_ROWS);
  if (error) {
    console.error("[contacts-export] No se pudieron leer los contactos");
    return NextResponse.json({ error: "No se pudieron leer los contactos" }, { status: 500 });
  }

  const rows = data.map((c) => {
    const tags = (c.contact_tags as unknown as { tags: { name: string } | null }[])
      .map((t) => t.tags?.name)
      .filter(Boolean)
      .join(", ");
    return [
      c.name ?? "",
      // Con espacios y sin «+»: Excel lo deja como texto (no notación científica ni fórmula).
      c.wa_id || c.phone ? formatPhone(c.wa_id ?? c.phone).replace(/^\+/, "") : "",
      isClassification(c.classification) ? CLASSIFICATION_LABELS[c.classification] : c.classification,
      tags,
      c.delivery_address ?? "",
      c.delivery_references ?? "",
      isContactSource(c.source) ? SOURCE_LABELS[c.source] : "",
      day(c.last_purchase_at),
      day(c.created_at),
    ];
  });

  const { error: logError } = await supabase
    .from("contact_exports")
    .insert({ user_id: check.userId, row_count: rows.length, filters: { tipo: "personas" } });
  if (logError) {
    // Sin registro no hay exportación (la auditoría es parte del requisito).
    console.error("[contacts-export] No se pudo registrar la exportación");
    return NextResponse.json({ error: "No se pudo registrar la exportación" }, { status: 500 });
  }

  const csv = toCsv(
    ["Nombre", "Teléfono", "Clasificación", "Etiquetas", "Dirección de entrega", "Referencias", "Origen", "Última compra", "Fecha de alta"],
    rows,
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contactos-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
