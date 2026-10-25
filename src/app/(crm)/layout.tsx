import { AppShell } from "@/components/crm/app-nav";
import { CrmProvider } from "@/components/crm/crm-provider";
import { NotificationsProvider } from "@/components/crm/notifications-provider";

// Rutas protegidas por src/proxy.ts. Los datos se cargan en el cliente con la
// sesión del usuario (RLS), así que el layout es estático.
export default function CrmLayout({ children }: LayoutProps<"/">) {
  return (
    <CrmProvider>
      <NotificationsProvider>
        <AppShell>{children}</AppShell>
      </NotificationsProvider>
    </CrmProvider>
  );
}
