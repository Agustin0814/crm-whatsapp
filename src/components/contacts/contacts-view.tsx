"use client";

import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import { ClassificationBadge } from "@/components/crm/classification-badge";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { PageHeader } from "@/components/crm/page-header";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage } from "@/lib/crm/contacts";
import type { Tables } from "@/lib/supabase/database.types";
import { formatPhone, formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { NewEntryDialog, type NewEntryPreset } from "./new-entry-dialog";

const PAGE_SIZE = 25;
/** Filas que entran escalonadas (30 ms entre una y otra) en la primera carga. */
const STAGGER_ROWS = 8;
const SEARCH_DEBOUNCE_MS = 300;

type DirectoryRow = Tables<"contact_directory">;

/** Pestañas del directorio: qué tipo y qué clasificación muestra cada una. */
const TABS = [
  { value: "todos", label: "Todos", kind: "all", classification: null },
  { value: "sin-clasificar", label: "Sin clasificar", kind: "all", classification: "unclassified" },
  { value: "prospectos", label: "Prospectos", kind: "all", classification: "prospect" },
  { value: "clientes", label: "Clientes", kind: "all", classification: "customer" },
  { value: "proveedores", label: "Proveedores", kind: "all", classification: "supplier" },
  { value: "empresas", label: "Empresas", kind: "company", classification: null },
] as const;
type Activity = "all" | "active" | "inactive";

function hrefFor(row: DirectoryRow): string {
  return row.kind === "company" ? `/contactos/empresa/${row.id}` : `/contactos/persona/${row.id}`;
}

/**
 * Directorio de personas y empresas. Busca por nombre, teléfono (con o sin
 * formato), correo, razón social o RFC; filtra por clasificación, actividad,
 * etiquetas y funciones. El orden es por última interacción.
 */
export function ContactsView() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { tags, roles } = useCrm();

  const requestedTab = searchParams.get("tab");
  const tab = TABS.find((t) => t.value === requestedTab) ?? TABS[0];
  const [activity, setActivity] = useState<Activity>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadCount, setLoadCount] = useState(0);
  const [preset, setPreset] = useState<NewEntryPreset | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const requestRef = useRef(0);

  // Reloj para «hace 3 días» (se actualiza cada minuto).
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  // Búsqueda con retardo.
  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;
    const t = setTimeout(() => {
      setPage(0);
      setLoading(true);
      setSearch(next);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  const effectiveActivity: Activity = tab.value === "clientes" ? activity : "all";

  useEffect(() => {
    const request = ++requestRef.current;
    supabase
      .rpc("search_directory", {
        p_search: search || undefined,
        p_kind: tab.kind,
        p_classification: tab.classification ?? undefined,
        p_activity: effectiveActivity,
        p_tag_ids: tagIds.length ? tagIds : undefined,
        p_role_ids: roleIds.length ? roleIds : undefined,
        // Se pide una fila extra para saber si hay página siguiente.
        p_limit: PAGE_SIZE + 1,
        p_offset: page * PAGE_SIZE,
      })
      .then(({ data, error }) => {
        if (request !== requestRef.current) return;
        if (error) {
          toast.error(errorMessage(error, "No se pudo cargar el directorio"));
          setRows([]);
          setHasMore(false);
        } else {
          setRows(data.slice(0, PAGE_SIZE));
          setHasMore(data.length > PAGE_SIZE);
        }
        setLoading(false);
        setLoadCount((n) => n + 1);
      });
  }, [supabase, search, tab.kind, tab.classification, effectiveActivity, tagIds, roleIds, page]);

  function changeTab(value: string) {
    setLoading(true);
    setPage(0);
    router.replace(value === "todos" ? pathname : `${pathname}?tab=${value}`, { scroll: false });
  }

  function changeFilter(apply: () => void) {
    setLoading(true);
    setPage(0);
    apply();
  }

  const filtered = search !== "" || tagIds.length > 0 || roleIds.length > 0 || effectiveActivity !== "all";
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const roleById = new Map(roles.map((r) => [r.id, r]));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Contactos"
        description="Personas y empresas: prospectos, clientes y proveedores."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Icon name="agregar" /> Nuevo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => setPreset({ kind: "person", classification: "unclassified" })}>
                <Icon name="persona" /> Persona
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPreset({ kind: "company", classification: "unclassified" })}>
                <Icon name="empresa" /> Empresa
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPreset({ kind: "company", classification: "supplier" })}>
                <Icon name="planta" /> Proveedor
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <Tabs value={tab.value} onValueChange={changeTab} className="gap-0">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b px-4 md:px-6">
          <TabsList variant="line" className="h-11">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="px-3">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:px-6">
        <div className="relative w-full sm:max-w-xs">
          <Icon name="buscar" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-texto-suave" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Nombre, teléfono, correo, RFC…"
            className="pl-8"
            aria-label="Buscar en el directorio"
          />
        </div>
        {tab.value === "clientes" && (
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="Actividad">
            {(
              [
                ["all", "Todos"],
                ["active", "Activos"],
                ["inactive", "Inactivos"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={activity === value}
                onClick={() => changeFilter(() => setActivity(value))}
                className={cn(
                  "h-7 rounded-md px-2.5 text-sm",
                  activity === value ? "bg-marca-suave font-medium text-marca-texto" : "text-texto-suave hover:bg-superficie-2",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <MultiFilter
          label="Etiquetas"
          options={tags.map((t) => ({ id: t.id, name: t.name, render: <TagChip tag={t} size="xs" /> }))}
          value={tagIds}
          onChange={(v) => changeFilter(() => setTagIds(v))}
        />
        <MultiFilter
          label="Funciones"
          options={roles.map((r) => ({ id: r.id, name: r.name }))}
          value={roleIds}
          onChange={(v) => changeFilter(() => setRoleIds(v))}
        />
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              changeFilter(() => {
                setSearchInput("");
                setSearch("");
                setTagIds([]);
                setRoleIds([]);
                setActivity("all");
              })
            }
          >
            Limpiar
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!loading && rows.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchXIcon}
              title="Nada coincide"
              description="Prueba con otra búsqueda o quita algún filtro."
            />
          ) : (
            <EmptyState
              icon={tab.kind === "company" ? "empresa" : "contactos"}
              title={tab.kind === "company" ? "Aún no hay empresas" : `Sin registros en «${tab.label}»`}
              description={
                tab.kind === "company"
                  ? "Crea una empresa con «Nuevo» o vincúlala desde la ficha de una persona."
                  : "Los contactos se crean solos cuando alguien escribe a tu WhatsApp, o con «Nuevo»."
              }
            />
          )
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden xl:table-cell">Tipo</TableHead>
                <TableHead className="hidden lg:table-cell">Empresa / contactos</TableHead>
                <TableHead>Clasificación</TableHead>
                <TableHead className="hidden md:table-cell">Etiquetas</TableHead>
                <TableHead className="hidden xl:table-cell">Funciones</TableHead>
                <TableHead className="hidden sm:table-cell">Última interacción</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)
                : rows.map((row, index) => {
                    const isCompany = row.kind === "company";
                    const stagger = loadCount === 1 && index < STAGGER_ROWS;
                    const rowTags = (row.tag_ids ?? []).map((id) => tagById.get(id)).filter((t) => t !== undefined);
                    const rowRoles = (row.role_ids ?? []).map((id) => roleById.get(id)).filter((r) => r !== undefined);
                    const related = row.related_names ?? [];
                    return (
                      <TableRow
                        key={`${row.kind}-${row.id}`}
                        className={cn("cursor-pointer", stagger && "entrada-fila")}
                        style={stagger ? ({ "--i": index } as CSSProperties) : undefined}
                        onClick={() => router.push(hrefFor(row))}
                      >
                        <TableCell>
                          <Link
                            href={hrefFor(row)}
                            className="flex items-center gap-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ContactAvatar
                              seed={row.wa_id ?? row.id ?? ""}
                              name={row.name}
                              company={isCompany ? row.name : null}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="max-w-56 truncate font-medium">{row.display_name}</p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {isCompany
                                  ? row.phone || row.email || "Empresa"
                                  : formatPhone(row.wa_id ?? row.phone)}
                              </p>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground xl:table-cell">
                          {isCompany ? "Empresa" : "Persona"}
                        </TableCell>
                        <TableCell className="hidden max-w-56 text-muted-foreground lg:table-cell">
                          {isCompany ? (
                            related.length === 0 ? (
                              "Sin contactos"
                            ) : (
                              <span className="block truncate" title={related.join(", ")}>
                                {related.length} {related.length === 1 ? "contacto" : "contactos"}: {related.join(", ")}
                              </span>
                            )
                          ) : related.length === 0 ? (
                            "—"
                          ) : (
                            <span className="block truncate" title={related.join(", ")}>
                              {related.join(", ")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ClassificationBadge classification={row.classification} inactive={row.is_inactive === true} size="xs" />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex max-w-xs flex-wrap gap-1">
                            {rowTags.slice(0, 3).map((t) => (
                              <TagChip key={t.id} tag={t} size="xs" />
                            ))}
                            {rowTags.length > 3 && <span className="text-xs text-texto-suave">+{rowTags.length - 3}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div className="flex max-w-56 flex-wrap gap-1">
                            {rowRoles.map((r) => (
                              <span key={r.id} className="inline-flex h-5 items-center rounded-full bg-info/15 px-2 text-[0.6875rem] font-medium">
                                {r.name}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {now === null ? " " : formatRelative(row.last_interaction, now)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {row.conversation_id ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon-sm" asChild>
                                  <Link href={`/?c=${row.conversation_id}`} aria-label="Abrir conversación">
                                    <Icon name="bandeja" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Abrir conversación</TooltipContent>
                            </Tooltip>
                          ) : (
                            !isCompany && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex size-8 items-center justify-center text-texto-suave/50" tabIndex={0}>
                                    <Icon name="bandeja" className="size-4" />
                                    <span className="sr-only">Sin conversación de WhatsApp</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Sin conversación de WhatsApp</TooltipContent>
                              </Tooltip>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        )}
      </div>

      {(page > 0 || hasMore) && (
        <footer className="flex items-center justify-between gap-2 border-t px-4 py-2 text-sm md:px-6">
          <span className="text-muted-foreground">Página {page + 1}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => changeFilter(() => setPage((p) => p - 1))}>
              <ChevronLeftIcon /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => changeFilter(() => setPage((p) => p + 1))}>
              Siguiente <ChevronRightIcon />
            </Button>
          </div>
        </footer>
      )}

      <NewEntryDialog preset={preset} onClose={() => setPreset(null)} />
    </div>
  );
}

/** Filtro de selección múltiple (etiquetas o funciones) en un popover con búsqueda. */
function MultiFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string; render?: ReactNode }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const selected = new Set(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(value.length > 0 && "border-marca text-marca-texto")}>
          <Icon name="filtros" /> {label}
          {value.length > 0 && ` (${value.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">Sin coincidencias</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.name}
                  onSelect={() => onChange(selected.has(o.id) ? value.filter((v) => v !== o.id) : [...value, o.id])}
                >
                  {o.render ?? o.name}
                  <CheckIcon className={selected.has(o.id) ? "ml-auto" : "invisible ml-auto"} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-14" /></TableCell>
      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
      <TableCell className="hidden xl:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell />
    </TableRow>
  );
}
