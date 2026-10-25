import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsSkeleton } from "@/components/crm/section-skeletons";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Configuración" };

// SettingsView lee ?tab= (useSearchParams), por eso va dentro de Suspense;
// el fallback es el mismo esqueleto que loading.tsx (sin saltos).
export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsView />
    </Suspense>
  );
}
