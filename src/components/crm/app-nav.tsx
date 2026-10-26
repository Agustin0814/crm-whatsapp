"use client";

import { BotIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { useMediaQuery } from "@/hooks/use-media-query";
import { BUSINESS_LABEL } from "@/lib/brand";
import { ROLE_LABELS, type Role } from "@/lib/crm/types";
import { writeSidebarCookie } from "@/lib/sidebar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { SidebarLogo } from "./brand-logo";
import { ContactAvatar } from "./contact-avatar";
import { profileName, useCrm } from "./crm-provider";
import { useNotifications, type RealtimeStatus } from "./notifications-provider";

type NavItem = { href: string; label: string; icon: IconName | LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Bandeja", icon: "bandeja" },
  { href: "/contactos", label: "Contactos", icon: "contactos" },
  // Provisional: Bot de lucide hasta que exista public/icons/icon-agentes.svg.
  { href: "/agentes", label: "Agentes", icon: BotIcon },
  { href: "/estadisticas", label: "Estadísticas", icon: "estadisticas" },
  { href: "/configuracion", label: "Configuración", icon: "configuracion" },
];

/** Icono de una opción del menú: de la marca (public/icons) o de lucide. */
function NavIcon({ icon, className }: { icon: NavItem["icon"]; className?: string }) {
  if (typeof icon === "string") return <Icon name={icon} className={className} />;
  const LucideComp = icon;
  return <LucideComp className={cn("shrink-0", className)} strokeWidth={2} aria-hidden />;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// --- Contexto del armazón ----------------------------------------------------

type ShellContextValue = {
  /** En móvil, la bandeja oculta la barra inferior mientras se lee un chat. */
  setHideBottomNav: (hide: boolean) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const value = use(ShellContext);
  if (!value) throw new Error("useShell debe usarse dentro de <AppShell>");
  return value;
}

/**
 * Barra lateral (≥ 768 px) + contenido + barra inferior (< 768 px).
 * `initialCollapsed` viene de la cookie leída en el servidor.
 */
export function AppShell({ children, initialCollapsed }: { children: ReactNode; initialCollapsed: boolean }) {
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const value = useMemo(() => ({ setHideBottomNav }), []);
  return (
    <ShellContext value={value}>
      <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
        <Sidebar initialCollapsed={initialCollapsed} />
        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-hidden md:pb-0",
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
        "inline-block size-2.5 shrink-0 rounded-full",
        status === "online" && "bg-exito",
        status === "reconnecting" && "animate-pulse bg-advertencia motion-reduce:animate-none",
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

/**
 * Texto de una fila: empieza SIEMPRE justo después de la columna de 72 px y
 * aparece con fundido al abrir. Recogida, la barra mide 72 px y lo recorta
 * (overflow hidden), así que ni el texto ni nada a su izquierda se mueve.
 */
const TEXTO_FILA =
  "min-w-0 flex-1 overflow-hidden whitespace-nowrap pr-3 opacity-0 transition-opacity duration-(--lateral-duracion) ease-in-out motion-reduce:transition-none sidebar-expanded:opacity-100";

/** Columna izquierda de cada fila: ancho fijo = barra recogida; icono centrado. */
const COLUMNA_ICONO = "relative flex w-(--lateral-ancho-mini) shrink-0 items-center justify-center";

/**
 * Capa de hover/foco de una fila, con margen de 8 px a cada lado. Es una capa
 * absoluta: no afecta a la posición del icono ni del texto.
 */
const CAPA_FILA =
  "pointer-events-none absolute inset-y-0 inset-x-2 rounded-xl transition-colors group-focus-visible/fila:ring-2 group-focus-visible/fila:ring-marca";

/** Índice de la sección activa según la ruta (las subrutas cuentan como su sección); -1 si ninguna. */
function activeIndex(pathname: string): number {
  return NAV_ITEMS.findIndex((item) => isActive(pathname, item.href));
}

// --- Barra lateral -----------------------------------------------------------

/**
 * Barra lateral colapsable que sigue el tema.
 *  - ≥ 1024 px: empuja el contenido; abierta o recogida según la preferencia
 *    del usuario (cookie sidebar_collapsed).
 *  - 768–1023 px: empieza recogida; al abrirla se superpone con fondo atenuado
 *    y se cierra al elegir una opción, al pulsar fuera o con Escape.
 *  - < 768 px: oculta (se usa la barra inferior).
 *
 * Estructura sin desplazamientos: TODAS las filas (logo, opciones, botón,
 * planta y perfil) tienen una columna izquierda de 72 px con el icono
 * centrado y el texto a la derecha. Al abrir/recoger solo cambian el ancho de
 * la barra y la opacidad del texto: ningún icono se mueve.
 *
 * El aspecto de cada estado lo resuelve el CSS (variantes sidebar-expanded /
 * sidebar-collapsed); el JavaScript solo guarda el estado, ARIA y tooltips.
 */
function Sidebar({ initialCollapsed }: { initialCollapsed: boolean }) {
  const pathname = usePathname();
  const { unreadConversations, realtimeStatus } = useNotifications();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [collapsed, setCollapsed] = useState(initialCollapsed); // ≥ 1024 px
  const [overlayOpen, setOverlayOpen] = useState(false); // 768–1023 px
  const toggleRef = useRef<HTMLButtonElement>(null);
  /**
   * Opción pulsada mientras la navegación aún no termina: la píldora se mueve
   * al instante, sin esperar a que cambie el pathname. En cuanto la ruta cambia
   * se descarta (estado derivado durante el render, sin efectos), así un
   * «atrás» del navegador nunca reutiliza un valor viejo.
   */
  const [pending, setPending] = useState<number | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setPending(null);
  }

  // Estado efectivo según el ancho (el CSS ya lo pinta; esto es para ARIA y tooltips).
  const expanded = isDesktop ? !collapsed : overlayOpen;
  const overlay = !isDesktop && overlayOpen;
  const current = pending ?? activeIndex(pathname);

  function toggle() {
    if (isDesktop) {
      const next = !collapsed;
      setCollapsed(next);
      writeSidebarCookie(next);
    } else {
      setOverlayOpen((open) => !open);
    }
  }

  // Modo superpuesto: Escape cierra y devuelve el foco al botón.
  useEffect(() => {
    if (!overlay) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOverlayOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay]);

  const closeOverlay = () => setOverlayOpen(false);
  const toggleLabel = expanded ? "Ocultar menú" : "Mostrar menú";

  return (
    <div
      className="sidebar-root relative hidden shrink-0 md:block"
      data-sidebar-collapsed={collapsed ? "true" : "false"}
      data-sidebar-overlay={overlayOpen ? "open" : "closed"}
    >
      {/* Fondo atenuado del modo superpuesto (solo 768–1023 px) */}
      {overlay && (
        <div
          className="fixed inset-0 z-40 bg-black/40 animate-in fade-in-0 motion-reduce:animate-none lg:hidden"
          onClick={closeOverlay}
          aria-hidden
        />
      )}

      {/* Hueco fijo en 768–1023 px: la barra abierta se superpone sin empujar */}
      <div className="w-(--lateral-ancho-mini) lg:hidden" aria-hidden />

      <nav
        id="barra-lateral"
        aria-label="Navegación principal"
        className={cn(
          "flex h-dvh flex-col overflow-hidden border-r border-lateral-borde bg-lateral text-lateral-texto",
          "w-(--lateral-ancho-mini) transition-[width] duration-(--lateral-duracion) ease-in-out motion-reduce:transition-none",
          "sidebar-expanded:w-(--lateral-ancho)",
          // 768–1023 px: siempre posicionada encima; abierta, con sombra.
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:sidebar-expanded:shadow-2xl",
        )}
      >
        {/* Logo solo, sin botones al lado: el cubo está fijo en la columna */}
        <Link
          href="/"
          onClick={() => {
            closeOverlay();
            if (pathname !== "/") setPending(0); // la píldora también va a Bandeja al instante
          }}
          aria-label="Ir a la bandeja"
          className="group/fila relative my-2 block shrink-0 focus-visible:outline-none"
        >
          <span className={CAPA_FILA} aria-hidden />
          <SidebarLogo />
        </Link>

        {/* Navegación con UNA píldora que se desliza hasta la opción activa */}
        <ul className="relative flex flex-col gap-1">
          <li
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-2 top-0 h-(--lateral-fila) rounded-xl bg-lateral-activo",
              "transition-[transform,opacity] duration-[250ms] ease-in-out motion-reduce:transition-none",
              current < 0 && "opacity-0",
            )}
            // Las opciones tienen altura fija: la posición sale del índice activo.
            style={{ transform: `translateY(calc(${Math.max(current, 0)} * var(--lateral-fila-paso)))` }}
          >
            {/* Acento de marca en el borde izquierdo de la barra */}
            <span className="absolute inset-y-2 -left-2 w-1 rounded-r-full bg-lateral-acento" />
          </li>

          {NAV_ITEMS.map((item, index) => {
            const active = index === current;
            const badge = item.href === "/" ? unreadConversations : 0;
            const link = (
              <Link
                href={item.href}
                onClick={() => {
                  closeOverlay();
                  if (!isActive(pathname, item.href)) setPending(index);
                }}
                // aria-current sigue a la ruta real, no a la píldora anticipada.
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "group/fila relative flex h-(--lateral-fila) items-center text-[0.9375rem] transition-colors duration-200 focus-visible:outline-none motion-reduce:transition-none",
                  active
                    ? "font-semibold text-lateral-activo-texto"
                    : "font-medium text-lateral-texto hover:text-lateral-texto-fuerte",
                )}
              >
                {/* Hover solo en las inactivas (la activa ya tiene la píldora) */}
                <span className={cn(CAPA_FILA, !active && "group-hover/fila:bg-lateral-hover")} aria-hidden />
                <span className={COLUMNA_ICONO}>
                  {/* Icono activo algo más grande (transform: no toca el layout) y con su color */}
                  <NavIcon
                    icon={item.icon}
                    className={cn(
                      // Tailwind v4: scale-* usa la propiedad CSS "scale" (no "transform").
                      "size-6 transition-[color,scale] duration-200 ease-out motion-reduce:transition-none",
                      active ? "scale-[1.08] text-lateral-activo-icono" : "text-lateral-texto-suave",
                    )}
                  />
                  {/* Recogida: insignia pequeña sobre el icono */}
                  {badge > 0 && (
                    <UnreadBadge
                      count={badge}
                      className="absolute top-1 right-3 h-4 min-w-4 px-1 text-[0.625rem] ring-2 ring-lateral transition-opacity duration-(--lateral-duracion) motion-reduce:transition-none sidebar-expanded:opacity-0"
                    />
                  )}
                </span>
                <span className={cn(TEXTO_FILA, "relative flex items-center")}>
                  <span className="flex-1 truncate">{item.label}</span>
                  {/* Abierta: contador junto al texto */}
                  {badge > 0 && <UnreadBadge count={badge} className="ml-2" />}
                </span>
              </Link>
            );
            return (
              <li key={item.href} className="relative">
                {expanded ? (
                  link
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                      {badge > 0 ? ` (${badge} sin leer)` : ""}
                    </TooltipContent>
                  </Tooltip>
                )}
              </li>
            );
          })}
        </ul>

        {/* Bloque inferior (de abajo hacia arriba): perfil, planta, botón */}
        <div className="mt-auto flex flex-col gap-1 pb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                ref={toggleRef}
                type="button"
                onClick={toggle}
                aria-label={toggleLabel}
                aria-expanded={expanded}
                aria-controls="barra-lateral"
                className="group/fila relative flex h-11 w-full items-center text-left text-sm font-medium text-lateral-texto-suave transition-colors hover:text-lateral-texto focus-visible:outline-none"
              >
                <span className={cn(CAPA_FILA, "group-hover/fila:bg-lateral-hover")} aria-hidden />
                <span className={COLUMNA_ICONO}>
                  <Icon name="menu-ocultar" className="hidden size-5 sidebar-expanded:block" />
                  <Icon name="menu-mostrar" className="size-5 sidebar-expanded:hidden" />
                </span>
                <span className={cn(TEXTO_FILA, "relative")}>Ocultar menú</span>
              </button>
            </TooltipTrigger>
            {!expanded && <TooltipContent side="right">{toggleLabel}</TooltipContent>}
          </Tooltip>

          {/* Planta + estado REAL de la conexión Realtime */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                tabIndex={expanded ? undefined : 0}
                role="status"
                aria-label={`${BUSINESS_LABEL}: ${STATUS_TEXT[realtimeStatus]}`}
                className="group/fila relative flex h-14 items-center focus-visible:outline-none"
              >
                {/* Tarjeta: capa con fundido detrás; no mueve el icono */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 inset-x-2 rounded-xl border border-lateral-tarjeta-borde bg-lateral-tarjeta opacity-0 transition-opacity duration-(--lateral-duracion) motion-reduce:transition-none sidebar-expanded:opacity-100"
                />
                <span className={cn(CAPA_FILA, "z-10")} aria-hidden />
                <span className={COLUMNA_ICONO}>
                  <Icon name="planta" className="size-7 text-lateral-texto" />
                  <StatusDot
                    status={realtimeStatus}
                    className="absolute right-4 -bottom-0.5 ring-2 ring-lateral transition-opacity duration-(--lateral-duracion) motion-reduce:transition-none sidebar-expanded:opacity-0"
                  />
                </span>
                <span className={cn(TEXTO_FILA, "relative block")}>
                  <span className="block truncate text-sm font-medium text-lateral-texto-fuerte">{BUSINESS_LABEL}</span>
                  <span className="flex items-center gap-1.5 text-xs text-lateral-texto-suave">
                    <StatusDot status={realtimeStatus} className="size-2" /> {STATUS_TEXT[realtimeStatus]}
                  </span>
                </span>
              </div>
            </TooltipTrigger>
            {!expanded && (
              <TooltipContent side="right">
                {BUSINESS_LABEL} · {STATUS_TEXT[realtimeStatus]}
              </TooltipContent>
            )}
          </Tooltip>

          <UserMenu expanded={expanded} />
        </div>
      </nav>
    </div>
  );
}

/** Pie de usuario: tema, perfil y cierre de sesión. Recogido, solo el avatar. */
function UserMenu({ expanded }: { expanded: boolean }) {
  const { me } = useCrm();
  const { theme, setTheme } = useTheme();
  const name = profileName(me);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group/fila relative flex h-14 w-full items-center text-left focus-visible:outline-none"
              aria-label={`Menú de usuario: ${name}`}
            >
              <span className={cn(CAPA_FILA, "group-hover/fila:bg-lateral-pie")} aria-hidden />
              <span className={COLUMNA_ICONO}>
                <ContactAvatar seed={me?.id ?? "yo"} name={me?.full_name} size="sm" />
              </span>
              <span className={cn(TEXTO_FILA, "relative block")}>
                <span className="block truncate text-sm font-medium text-lateral-texto-fuerte">{name}</span>
                {me && (
                  <span className="block text-xs text-lateral-texto-suave">{ROLE_LABELS[me.role as Role] ?? me.role}</span>
                )}
              </span>
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        {!expanded && <TooltipContent side="right">{name}</TooltipContent>}
      </Tooltip>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
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

// --- Barra inferior (< 768 px) -------------------------------------------------------

function BottomNav() {
  const pathname = usePathname();
  const { unreadConversations } = useNotifications();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-lateral-borde bg-lateral pb-[env(safe-area-inset-bottom)] md:hidden"
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
              active ? "text-lateral-activo-texto" : "text-lateral-texto-suave hover:text-lateral-texto",
            )}
          >
            {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-b-full bg-lateral-acento" aria-hidden />}
            <span className="relative">
              <NavIcon icon={item.icon} className={cn("size-6", active && "text-lateral-activo-icono")} />
              {badge > 0 && <UnreadBadge count={badge} className="absolute -top-1.5 -right-3" />}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
