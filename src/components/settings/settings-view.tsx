"use client";

import { BellIcon, MonitorIcon, MoonIcon, SunIcon, Volume2Icon } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCrm } from "@/components/crm/crm-provider";
import { useNotifications } from "@/components/crm/notifications-provider";
import { PageHeader } from "@/components/crm/page-header";
import { QuickRepliesView } from "@/components/quick-replies/quick-replies-view";
import { TagsView } from "@/components/tags/tags-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RolesSettings } from "./roles-settings";
import { SalesSettings } from "./sales-settings";
import { SectionHeader } from "./section-header";
import { ProfileSection } from "./profile-section";
import { UsersAdmin } from "./users-admin";

export const SETTINGS_TABS = [
  { value: "perfil", label: "Perfil", adminOnly: false },
  { value: "usuarios", label: "Usuarios", adminOnly: true },
  { value: "notificaciones", label: "Notificaciones", adminOnly: false },
  { value: "apariencia", label: "Apariencia", adminOnly: false },
  { value: "etiquetas", label: "Etiquetas", adminOnly: true },
  { value: "respuestas-rapidas", label: "Respuestas rápidas", adminOnly: true },
  { value: "funciones", label: "Funciones", adminOnly: true },
  { value: "contactos-ventas", label: "Contactos y ventas", adminOnly: true },
] as const;

type TabValue = (typeof SETTINGS_TABS)[number]["value"];

function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-sm text-texto-suave">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** Configuración con pestañas. La pestaña activa vive en ?tab= para poder enlazarla. */
export function SettingsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin, loading } = useCrm();

  const requested = searchParams.get("tab");
  const available = SETTINGS_TABS.filter((t) => !t.adminOnly || isAdmin);
  const tab: TabValue = available.some((t) => t.value === requested) ? (requested as TabValue) : "perfil";

  function changeTab(value: string) {
    router.replace(`${pathname}?tab=${value}`, { scroll: false });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={isAdmin || loading ? "Configuración" : "Mi perfil"}
        description={isAdmin || loading ? "Tu perfil, el equipo, las notificaciones y los catálogos del CRM." : "Tu nombre, tu avatar, tu contraseña y tus avisos."}
      />

      <Tabs value={tab} onValueChange={changeTab} className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b px-4 md:px-6">
          <TabsList variant="line" className="h-11">
            {available.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="px-3">
                {t.label}
              </TabsTrigger>
            ))}
            {/* Mientras carga el rol, se reserva el hueco de la pestaña de admin */}
            {loading && <Skeleton className="ml-2 h-5 w-16" />}
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl p-4 md:p-6">
            <TabsContent value="perfil">
              <ProfileSection />
            </TabsContent>
            <TabsContent value="notificaciones">
              <NotificationsSection />
            </TabsContent>
            <TabsContent value="apariencia">
              <AppearanceSection />
            </TabsContent>
            {/* Pestañas de administración: ni se montan para otros roles. */}
            {isAdmin && (
              <>
                <TabsContent value="usuarios">
                  <section className="space-y-4">
                    <SectionHeader
                      title="Usuarios y roles"
                      description="Vendedores: todos los chats y contactos. Repartidores: solo los chats en reparto. Administradores: además usuarios, agentes, estadísticas y configuración."
                    />
                    <UsersAdmin />
                  </section>
                </TabsContent>
                <TabsContent value="etiquetas">
                  <TagsView />
                </TabsContent>
                <TabsContent value="respuestas-rapidas">
                  <QuickRepliesView />
                </TabsContent>
                <TabsContent value="funciones">
                  <RolesSettings />
                </TabsContent>
                <TabsContent value="contactos-ventas">
                  <SalesSettings />
                </TabsContent>
              </>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  );
}

// --- Notificaciones ---------------------------------------------------------------

function NotificationsSection() {
  const n = useNotifications();
  const permissionText =
    n.permission === "unsupported"
      ? "Este navegador no admite notificaciones."
      : n.permission === "denied"
        ? "Bloqueadas en el navegador. Habilítalas desde el candado de la barra de direcciones."
        : n.desktopEnabled
          ? "Activas: recibirás un aviso cuando llegue un mensaje y la pestaña no esté visible."
          : "Avisos del sistema cuando llegue un mensaje y la pestaña no esté visible.";

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Notificaciones"
        description="Solo para mensajes entrantes. Nunca de tus propios mensajes ni de conversaciones archivadas. Se guarda en este navegador."
      />
      <div className="divide-y rounded-xl border px-5">
        <Row title="Sonido" description="Un tono breve al llegar un mensaje (como máximo uno por segundo).">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={n.playTestSound}>
              <Volume2Icon aria-hidden /> Probar
            </Button>
            <Switch checked={n.soundEnabled} onCheckedChange={n.setSoundEnabled} aria-label="Sonido de notificación" />
          </div>
        </Row>
        <Row title="Notificaciones del navegador" description={permissionText}>
          {n.desktopEnabled && n.permission === "granted" ? (
            <Button variant="outline" size="sm" onClick={n.disableDesktop}>
              Desactivar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => void n.enableDesktop()}
              disabled={n.permission === "unsupported" || n.permission === "denied"}
            >
              <BellIcon aria-hidden /> Activar
            </Button>
          )}
        </Row>
        <Row title="Contador en la pestaña" description="El título muestra los mensajes sin leer, p. ej. «(3) LG Blocks CRM».">
          <span className="text-sm text-texto-suave">Siempre activo</span>
        </Row>
      </div>
    </section>
  );
}

// --- Apariencia ---------------------------------------------------------------------

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="space-y-4">
      <SectionHeader
        title="Apariencia"
        description="El área de trabajo es clara por defecto. La barra lateral siempre es oscura."
      />
      <div className="rounded-xl border px-5">
        <Row title="Tema" description="«Sistema» sigue la configuración de tu dispositivo.">
          <ToggleGroup
            type="single"
            variant="outline"
            value={theme ?? "light"}
            onValueChange={(v) => v && setTheme(v)}
            aria-label="Tema"
          >
            <ToggleGroupItem value="light" aria-label="Claro">
              <SunIcon aria-hidden /> <span className="hidden sm:inline">Claro</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" aria-label="Oscuro">
              <MoonIcon aria-hidden /> <span className="hidden sm:inline">Oscuro</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="system" aria-label="Sistema">
              <MonitorIcon aria-hidden /> <span className="hidden sm:inline">Sistema</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </Row>
      </div>
    </section>
  );
}
