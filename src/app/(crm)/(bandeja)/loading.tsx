import { InboxSkeleton } from "@/components/crm/section-skeletons";

// Mientras llega la sección: la barra lateral (layout) se queda; solo cambia el área principal.
export default function Loading() {
  return <InboxSkeleton />;
}
