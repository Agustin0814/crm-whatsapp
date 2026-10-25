"use client";

import { BellIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon, Volume2Icon } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { EditableField } from "@/components/contacts/editable-field";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { useNotifications } from "@/components/crm/notifications-provider";
import { PageHeader } from "@/components/crm/page-header";
import { QuickRepliesView } from "@/components/quick-replies/quick-replies-view";
import { TagsView } from "@/components/tags/tags-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { errorMessage } from "@/lib/crm/contacts";
import { ROLE_LABELS, type Role } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { SectionHeader } from "./section-header";
import { UsersAdmin } from "./users-admin";

export const SETTINGS_TABS = [
  { value: "perfil", label: "Perfil", adminOnly: false },
  { value: "usuarios", label: "Usuarios", adminOnly: true },
  { value: "notificaciones", label: "Notificaciones", adminOnly: false },
  { value: "apariencia", label: "Apariencia", adminOnly: false },
  { value: "etiquetas", label: "Etiquetas", adminOnly: false },
  { value: "respuestas-rapidas", label: "Respuestas rápidas", adminOnly: false },
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
      <PageHeader title="Configuración" description="Tu perfil, el equipo, las notificaciones y los catálogos del CRM." />

      <Tabs value={tab} onValueChange={changeTab} className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="overflow-x-auto border-b px-4 md:px-6">
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
            {isAdmin && (
              <TabsContent value="usuarios">
                <section className="space-y-4">
                  <SectionHeader
                    title="Usuarios y roles"
                    description="Los agentes usan la bandeja; los administradores además gestionan usuarios, eliminan etiquetas y administran las respuestas rápidas."
                  />
                  <UsersAdmin />
                </section>
              </TabsContent>
            )}
            <TabsContent value="notificaciones">
              <NotificationsSection />
            </TabsContent>
            <TabsContent value="apariencia">
              <AppearanceSection />
            </TabsContent>
            <TabsContent value="etiquetas">
              <TagsView />
            </TabsContent>
            <TabsContent value="respuestas-rapidas">
              <QuickRepliesView />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

// --- Perfil ---------------------------------------------------------------------

function ProfileSection() {
  const supabase = createClient();
  const { me, isAdmin, loading, reloadProfiles } = useCrm();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function saveName(fullName: string | null) {
    if (!me) return;
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", me.id);
    if (error) {
      toast.error(errorMessage(error, "No se pudo guardar el nombre"));
      throw error;
    }
    toast.success("Nombre actualizado");
    await reloadProfiles();
  }

  return (
    <section className="space-y-6">
      <SectionHeader title="Perfil" description="Así te verá tu equipo al asignar conversaciones y en las notas internas." />
      {loading || !me ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : (
        <div className="flex flex-col gap-6 rounded-xl border p-5 sm:flex-row sm:items-start">
          <ContactAvatar seed={me.id} name={me.full_name} size="xl" />
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold">{profileName(me)}</p>
              <Badge variant={isAdmin ? "default" : "secondary"}>{ROLE_LABELS[me.role as Role] ?? me.role}</Badge>
            </div>
            <EditableField icon="persona" label="Nombre" value={me.full_name} placeholder="Tu nombre" onSave={saveName} />
            <div className="flex items-start gap-3">
              <Icon name="correo" className="mt-1 size-5 text-texto-suave" />
              <div>
                <p className="text-xs font-medium text-texto-suave">Correo</p>
                <p className="text-sm">{email ?? " "}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <Button variant="outline" onClick={() => void createClient().auth.signOut()}>
        <LogOutIcon aria-hidden /> Cerrar sesión
      </Button>
    </section>
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
