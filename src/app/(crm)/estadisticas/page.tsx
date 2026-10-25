import type { Metadata } from "next";
import { EmptyState } from "@/components/crm/empty-state";
import { PageHeader } from "@/components/crm/page-header";

export const metadata: Metadata = { title: "Estadísticas" };

// Página provisional: el tablero de estadísticas todavía no está construido.
export default function StatsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Estadísticas" description="Métricas de atención de tu equipo." />
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon="estadisticas"
          title="Próximamente"
          description="Aquí verás el volumen de conversaciones, los tiempos de respuesta y el trabajo de cada agente."
        />
      </div>
    </div>
  );
}
