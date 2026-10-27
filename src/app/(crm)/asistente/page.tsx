import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantView } from "@/components/assistant/assistant-view";
import { AssistantSkeleton } from "@/components/crm/section-skeletons";

export const metadata: Metadata = { title: "Asistente" };

// AssistantView lee ?chat= (useSearchParams): va dentro de Suspense.
export default function AssistantPage() {
  return (
    <Suspense fallback={<AssistantSkeleton />}>
      <AssistantView />
    </Suspense>
  );
}
