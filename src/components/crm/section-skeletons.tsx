import type { ReactNode } from "react";
import { PageHeader } from "@/components/crm/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/*
 * Pantallas de carga por sección (loading.tsx y fallbacks de Suspense).
 * Repiten la MISMA estructura, clases y medidas que el contenido real para que
 * al llegar los datos no haya saltos de layout. Los encabezados de página son
 * texto fijo: se usa el PageHeader real, idéntico al de la página.
 */

/**
 * Contenedor de una pantalla de carga. Empieza invisible y aparece con un
 * retraso de 150 ms solo con CSS (.esqueleto-entrada): si la carga es rápida,
 * el esqueleto nunca se llega a ver (sin destello).
 */
export function SkeletonScreen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("esqueleto-entrada flex h-full min-h-0 flex-1 flex-col", className)}>
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}

// --- Bandeja ---------------------------------------------------------------------

/** Fila de la lista de conversaciones: avatar, nombre + hora, vista previa y etiqueta (98 px). */
function ConversationRowSkeleton({ preview }: { preview: string }) {
  return (
    <div className="flex gap-3 rounded-xl border-l-[3px] border-transparent px-3 py-3">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex h-6 items-center justify-between gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="flex h-5 items-center">
          <Skeleton className={cn("h-3.5", preview)} />
        </div>
        <div className="flex pt-0.5">
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

const BUBBLES = [
  { out: false, w: "w-40" },
  { out: false, w: "w-56" },
  { out: true, w: "w-48" },
  { out: false, w: "w-32" },
  { out: true, w: "w-64" },
  { out: true, w: "w-36" },
];

export function InboxSkeleton() {
  return (
    <SkeletonScreen className="flex-row">
      {/* Lista de conversaciones (mismas clases que ConversationList) */}
      <aside className="flex min-h-0 w-full flex-col border-r bg-background lg:w-(--lista-ancho) lg:shrink-0">
        <div className="space-y-3 px-4 pt-5 pb-3">
          <h1 className="text-2xl font-bold tracking-tight">Bandeja</h1>
          <div className="flex items-center gap-1">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="size-9 rounded-lg" />
          </div>
          <div className="flex gap-1.5">
            {["w-16", "w-24", "w-14", "w-24"].map((w, i) => (
              <Skeleton key={i} className={cn("h-8 shrink-0 rounded-full", w)} />
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden px-2 pb-2">
          {["w-4/5", "w-3/5", "w-2/3", "w-1/2", "w-3/4", "w-2/5", "w-3/5"].map((w, i) => (
            <ConversationRowSkeleton key={i} preview={w} />
          ))}
        </div>
      </aside>

      {/* Chat (desde 1024 px): encabezado, burbujas alternadas y campo de texto */}
      <section className="hidden min-w-0 flex-1 flex-col lg:flex">
        <div className="flex min-h-16 items-center gap-3 border-b px-4 py-2">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="ml-auto flex gap-1.5">
            <Skeleton className="hidden h-10 w-36 rounded-lg xl:block" />
            <Skeleton className="hidden h-10 w-44 rounded-lg xl:block" />
            <Skeleton className="size-9 rounded-md" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {BUBBLES.map((b, i) => (
              <div key={i} className={cn("flex items-end gap-2", b.out ? "justify-end" : "justify-start")}>
                {!b.out && <Skeleton className="size-8 shrink-0 rounded-full" />}
                <Skeleton className={cn("h-12 rounded-2xl", b.w)} />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3 border-t px-6 py-3">
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="flex items-end gap-2">
            <Skeleton className="h-12 flex-1 rounded-2xl" />
            <Skeleton className="size-12 rounded-full" />
          </div>
        </div>
      </section>

      {/* Ficha del contacto (columna desde 1536 px, abierta por defecto) */}
      <aside className="hidden w-(--ficha-ancho) shrink-0 flex-col border-l bg-background 2xl:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="space-y-5 px-5 py-5">
          <div className="flex items-center gap-4">
            <Skeleton className="size-18 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3 border-t pt-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </aside>
    </SkeletonScreen>
  );
}

// --- Contactos ---------------------------------------------------------------------

export function ContactsSkeleton() {
  return (
    <SkeletonScreen>
      <PageHeader
        title="Contactos"
        description="Personas y empresas: prospectos, clientes y proveedores."
        actions={<Skeleton className="h-9 w-24 rounded-lg" />}
      />
      {/* Pestañas (Todos, Sin clasificar, Prospectos…) */}
      <div className="border-b px-4 md:px-6">
        <div className="flex h-11 items-center gap-6 overflow-hidden">
          {["w-12", "w-24", "w-20", "w-16", "w-20", "w-16"].map((w, i) => (
            <Skeleton key={i} className={cn("h-3.5 shrink-0", w)} />
          ))}
        </div>
      </div>
      {/* Barra de búsqueda y filtros (mismas clases que ContactsView) */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:px-6">
        <Skeleton className="h-8 w-full rounded-lg sm:max-w-xs" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-10 items-center gap-6 border-b px-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="hidden h-3 w-24 lg:block" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="hidden h-3 w-16 md:block" />
          <Skeleton className="hidden h-3 w-24 sm:block" />
        </div>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex h-[53px] items-center gap-6 border-b px-2">
            <div className="flex w-56 items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="hidden h-4 w-28 lg:block" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
            <Skeleton className="hidden h-4 w-20 sm:block" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

/** Ficha completa (persona o empresa): encabezado, tarjetas de resumen y pestañas. */
export function ProfileSkeleton() {
  return (
    <SkeletonScreen>
      <div className="flex items-center gap-3 border-b px-4 py-4 md:px-6">
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="size-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <div className="flex h-11 items-center gap-6 border-b">
            {["w-16", "w-28", "w-32", "w-12"].map((w, i) => (
              <Skeleton key={i} className={cn("h-3.5", w)} />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </SkeletonScreen>
  );
}

// --- Configuración -----------------------------------------------------------------

export function SettingsSkeleton() {
  return (
    <SkeletonScreen>
      <PageHeader title="Configuración" description="Tu perfil, el equipo, las notificaciones y los catálogos del CRM." />
      {/* Pestañas (33 px con el borde) */}
      <div className="border-b px-4 md:px-6">
        <div className="flex h-8 items-center gap-6 overflow-hidden">
          {["w-12", "w-16", "w-24", "w-20", "w-16", "w-32", "w-16", "w-32"].map((w, i) => (
            <Skeleton key={i} className={cn("h-3.5 shrink-0", w)} />
          ))}
        </div>
      </div>
      {/* Bloques con forma de formulario */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="flex flex-col gap-6 rounded-xl border p-5 sm:flex-row sm:items-start">
            <Skeleton className="size-18 shrink-0 rounded-full" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-6 w-48" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
          </div>
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
    </SkeletonScreen>
  );
}

// --- Estadísticas -------------------------------------------------------------------

export function StatsSkeleton() {
  return (
    <SkeletonScreen>
      <PageHeader title="Estadísticas" description="Métricas de atención de tu equipo." />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 px-6 py-12">
          <Skeleton className="size-14 rounded-2xl" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-72" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
