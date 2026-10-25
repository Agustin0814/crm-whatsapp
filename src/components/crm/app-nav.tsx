"use client";

import { LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, use, useMemo, useState, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon, type IconName } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BUSINESS_LABEL } from "@/lib/brand";
import { ROLE_LABELS, type Role } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { SidebarLogo } from "./brand-logo";
import { ContactAvatar } from "./contact-avatar";
import { profileName, useCrm } from "./crm-provider";
import { useNotifications, type RealtimeStatus } from "./notifications-provider";

type NavItem = { href: string; label: string; icon: IconName };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Bandeja", icon: "bandeja" },
  { href: "/contactos", label: "Contactos", icon: "contactos" },
  { href: "/estadisticas", label: "Estadísticas", icon: "estadisticas" },
  { href: "/configuracion", label: "Configuración", icon: "configuracion" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// --- Contexto del armazón ----------------------------------------------------

type ShellContextValue = {
  /** En móvil/tablet, la bandeja oculta la barra inferior mientras se lee un chat. */
  setHideBottomNav: (hide: boolean) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const value = use(ShellContext);
  if (!value) throw new Error("useShell debe usarse dentro de <AppShell>");
  return value;
}

/** Barra lateral (escritorio) + contenido + barra inferior (móvil y tablet). */
export function AppShell({ children }: { children: ReactNode }) {
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const value = useMemo(() => ({ setHideBottomNav }), []);
  return (
    <ShellContext value={value}>
      <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
        <Sidebar />
        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-hidden lg:pb-0",
            !hideBottomNav && "pb-[calc(var(--barra-inferior-alto)+env(safe-area-inset-bottom))]",
          )}
        >
          {children}
        </main>
        {!hideBottomNav && <BottomNav />}
      </div>
    </ShellContext>
  );
}

// --- Piezas comunes ---------------------------------------------------------------

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full bg-marca-fuerte px-1.5 text-[0.6875rem] font-semibold text-white tabular-nums",
        className,
      )}
      aria-label={`${count} conversaciones sin leer`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

const STATUS_TEXT: Record<RealtimeStatus, string> = {
  connecting: "Conectando…",
  online: "En línea",
  reconnecting: "Reconectando…",
};

function StatusDot({ status, className }: { status: RealtimeStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        status === "online" && "bg-exito",
        status === "reconnecting" && "animate-pulse bg-advertencia",
        status === "connecting" && "bg-lateral-texto-suave",
        className,
      )}
      aria-hidden
    />
  );
}

async function signOut() {
  await createClient().auth.signOut();
  // CrmProvider redirige al login al recibir SIGNED_OUT.
}

// --- Barra lateral -----------------------------------------------------------

/**
 * Barra lateral oscura (≥ 1024 px). Contraída (solo iconos + logo-icono) hasta
 * 1280 px; expandida con etiquetas y logo completo a partir de 1280 px.
 */
function Sidebar() {
  const pathname = usePathname();
  const { unreadConversations, realtimeStatus } = useNotifications();

  return (
    <nav
      aria-label="Navegación principal"
      className="dark hidden w-(--lateral-ancho-mini) shrink-0 flex-col bg-lateral text-lateral-texto lg:flex xl:w-(--lateral-ancho)"
    >
      <div className="flex h-20 items-center justify-center px-3 xl:justify-start xl:px-5">
        <Link href="/" aria-label="Ir a la bandeja" className="rounded-lg">
          <SidebarLogo />
        </Link>
      </div>

      <ul className="mt-2 flex flex-col gap-1 px-2 xl:px-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const badge = item.href === "/" ? unreadConversations : 0;
          return (
            <li key={item.href}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                    className={cn(
                      "relative flex h-12 items-center justify-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium transition-colors xl:justify-start",
                      active
                        ? "bg-lateral-activo text-white"
                        : "text-lateral-texto hover:bg-lateral-2 hover:text-white",
                    )}
                  >
                    {/* Barra naranja del ítem activo */}
                    {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-marca" aria-hidden />}
                    <Icon name={item.icon} className={cn("size-6", active && "text-marca")} />
                    <span className="hidden flex-1 xl:inline">{item.label}</span>
                    {badge > 0 && (
                      <UnreadBadge count={badge} className="absolute top-1 right-1 xl:static" />
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="xl:hidden">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-2 p-2 xl:p-3">
        {/* Sucursal + estado REAL de la conexión Realtime */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center justify-center gap-3 rounded-xl border border-lateral-borde bg-lateral-2 p-3 xl:justify-start"
              role="status"
              aria-label={`${BUSINESS_LABEL}: ${STATUS_TEXT[realtimeStatus]}`}
            >
              <span className="relative">
                <Icon name="planta" className="size-7 text-lateral-texto" />
                <StatusDot status={realtimeStatus} className="absolute -right-0.5 -bottom-0.5 ring-2 ring-lateral-2 xl:hidden" />
              </span>
              <div className="hidden min-w-0 xl:block">
                <p className="truncate text-sm font-medium text-white">{BUSINESS_LABEL}</p>
                <p className="flex items-center gap-1.5 text-xs text-lateral-texto-suave">
                  <StatusDot status={realtimeStatus} /> {STATUS_TEXT[realtimeStatus]}
                </p>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="xl:hidden">
            {BUSINESS_LABEL} · {STATUS_TEXT[realtimeStatus]}
          </TooltipContent>
        </Tooltip>

        <UserMenu />
      </div>
    </nav>
  );
}

/** Usuario actual: tema, configuración y cierre de sesión. */
function UserMenu() {
  const { me } = useCrm();
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center gap-3 rounded-xl p-2 text-left hover:bg-lateral-2 xl:justify-start"
          aria-label="Menú de usuario"
        >
          <ContactAvatar seed={me?.id ?? "yo"} name={me?.full_name} size="sm" />
          <span className="hidden min-w-0 flex-1 xl:block">
            <span className="block truncate text-sm font-medium text-white">{profileName(me)}</span>
            {me && <span className="block text-xs text-lateral-texto-suave">{ROLE_LABELS[me.role as Role] ?? me.role}</span>}
          </span>
        </button>
      </DropdownMenuTrigger>
      {/* El menú se muestra con el tema del área de trabajo, no el de la barra */}
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{profileName(me)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/configuracion?tab=perfil">
            <Icon name="persona" /> Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SunIcon className="dark:hidden" aria-hidden />
            <MoonIcon className="hidden dark:block" aria-hidden /> Tema
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme ?? "light"} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <SunIcon aria-hidden /> Claro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <MoonIcon aria-hidden /> Oscuro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <MonitorIcon aria-hidden /> Sistema
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOutIcon aria-hidden /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Barra inferior (móvil y tablet) -----------------------------------------------

function BottomNav() {
  const pathname = usePathname();
  const { unreadConversations } = useNotifications();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-lateral-borde bg-lateral pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const badge = item.href === "/" ? unreadConversations : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-(--barra-inferior-alto) flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
              active ? "text-white" : "text-lateral-texto-suave hover:text-white",
            )}
          >
            {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-b-full bg-marca" aria-hidden />}
            <span className="relative">
              <Icon name={item.icon} className={cn("size-6", active && "text-marca")} />
              {badge > 0 && <UnreadBadge count={badge} className="absolute -top-1.5 -right-3" />}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
