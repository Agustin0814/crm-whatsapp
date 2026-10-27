import { after, NextResponse, type NextRequest } from "next/server";
import { executeManualNotesRequest } from "@/lib/agents/notes-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// La pasada de notas puede llamar al modelo dentro de after().
export const maxDuration = 60;

type Body = { action?: unknown };

/**
 * Confirma o cancela una solicitud del Asistente del sistema. La confirmación
 * la valida la BASE con la sesión de quien la pidió (confirm_agent_request):
 * el texto del modelo nunca cuenta como confirmación. Pausar o reanudar se
 * aplican ahí mismo; «anotar ahora» queda en cola y se ejecuta en after().
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/assistant/requests/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as Body;
  const action = body.action === "confirm" || body.action === "cancel" ? body.action : null;
  if (!action || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Petición no válida" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = action === "confirm" ? await supabase.rpc("confirm_agent_request", { p_id: id }) : await supabase.rpc("cancel_agent_request", { p_id: id });
  if (error || !data) return NextResponse.json({ error: error?.message ?? "No se pudo actualizar la solicitud" }, { status: 409 });

  if (action === "confirm" && data.status === "queued" && data.action === "notes.run_now") {
    after(() => executeManualNotesRequest(createAdminClient(), data.id));
  }
  return NextResponse.json({ request: data });
}
