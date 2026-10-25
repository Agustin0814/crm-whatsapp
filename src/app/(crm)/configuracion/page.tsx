import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsView } from "@/components/settings/settings-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Configuración" };

// SettingsView lee ?tab= (useSearchParams), por eso va dentro de Suspense.
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      }
    >
      <SettingsView />
    </Suspense>
  );
}
