import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/crm/app-nav";
import { CrmProvider } from "@/components/crm/crm-provider";
import { NotificationsProvider } from "@/components/crm/notifications-provider";
import { parseSidebarCookie, SIDEBAR_COOKIE } from "@/lib/sidebar";

/**
 * Lee la preferencia de la barra lateral en el SERVIDOR para pintar el estado
 * correcto desde el primer render (sin parpadeo). Con cacheComponents, leer
 * cookies() debe ir dentro de <Suspense>; la lectura es inmediata y el armazón
 * llega en la misma respuesta.
 */
async function ShellWithPreference({ children }: { children: ReactNode }) {
  const collapsed = parseSidebarCookie((await cookies()).get(SIDEBAR_COOKIE)?.value);
  return <AppShell initialCollapsed={collapsed}>{children}</AppShell>;
}

// Rutas protegidas por src/proxy.ts. Los datos se cargan en el cliente con la
// sesión del usuario (RLS).
export default function CrmLayout({ children }: LayoutProps<"/">) {
  return (
    <CrmProvider>
      <NotificationsProvider>
        {/* Respaldo neutro (solo el fondo) para que no aparezca una barra que luego cambie */}
        <Suspense fallback={<div className="h-dvh bg-background" />}>
          <ShellWithPreference>{children}</ShellWithPreference>
        </Suspense>
      </NotificationsProvider>
    </CrmProvider>
  );
}
