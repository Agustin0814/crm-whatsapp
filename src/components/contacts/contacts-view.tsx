"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchXIcon,
} from "lucide-react";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { useCrm } from "@/components/crm/crm-provider";
import { EmptyState } from "@/components/crm/empty-state";
import { PageHeader } from "@/components/crm/page-header";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/crm/contacts";
import { normalizeContact } from "@/lib/crm/conversations";
import type { Contact, ContactWithTags, Tag } from "@/lib/crm/types";
import { formatDate, formatPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ContactDetails } from "./contact-details";
import { TagPicker } from "./tag-picker";

const PAGE_SIZE = 25;
const ALL_TAGS = "__todas__";

type SortColumn = "name" | "company" | "updated_at" | "created_at";
type Row = ContactWithTags & { conversationId: string | null };
type RawRow = Contact & {
  contact_tags: { tags: Tag | null }[];
  conversations: { id: string } | null;
};

/** Quita caracteres con significado especial en los filtros de PostgREST. */
function sanitizeSearch(value: string): string {
  return value.replace(/[%,()*\\:"]/g, " ").trim();
}

export function ContactsView() {
  const supabase = createClient();
  const { tags } = useCrm();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tagId, setTagId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ column: SortColumn; ascending: boolean }>({ column: "updated_at", ascending: false });
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const requestRef = useRef(0);

  // Búsqueda con retardo.
  useEffect(() => {
    const next = sanitizeSearch(searchInput);
    if (next === search) return;
    const t = setTimeout(() => {
      setPage(0);
      setLoading(true);
      setSearch(next);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  useEffect(() => {
    const request = ++requestRef.current;
    // El filtro por etiqueta usa un segundo embedding con !inner.
    const select = tagId
      ? "*, contact_tags(tags(*)), conversations(id), filtro:contact_tags!inner(tag_id)"
      : "*, contact_tags(tags(*)), conversations(id)";
    let query = supabase.from("contacts").select(select, { count: "exact" });
    if (tagId) query = query.eq("filtro.tag_id", tagId);
    if (search) {
      const p = `%${search}%`;
      query = query.or(`name.ilike.${p},wa_id.ilike.${p},phone.ilike.${p},email.ilike.${p},company.ilike.${p}`);
    }
    query
      .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
      .order("id")
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      .then(({ data, error, count }) => {
        if (request !== requestRef.current) return;
        if (error) {
          toast.error(errorMessage(error, "No se pudieron cargar los contactos"));
        } else {
          const raw = data as unknown as RawRow[];
          setRows(
            raw.map(({ conversations, ...contact }) => ({
              ...normalizeContact({ ...contact, contact_tags: contact.contact_tags }),
              conversationId: conversations?.id ?? null,
            })),
          );
          setTotal(count ?? 0);
        }
        setLoading(false);
      });
  }, [supabase, search, tagId, sort, page]);

  function changeSort(column: SortColumn) {
    setLoading(true);
    setPage(0);
    setSort((s) => (s.column === column ? { column, ascending: !s.ascending } : { column, ascending: column === "name" || column === "company" }));
  }

  function updateRow(contact: ContactWithTags) {
    setRows((prev) => prev.map((r) => (r.id === contact.id ? { ...r, ...contact } : r)));
  }

  const open = rows.find((r) => r.id === openId) ?? null;
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const filtered = search !== "" || tagId !== null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Contactos" description="Personas que han escrito a tu número de WhatsApp." />

      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:px-6">
        <div className="relative w-full sm:max-w-xs">
          <Icon name="buscar" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-texto-suave" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre, teléfono, correo o empresa"
            className="pl-8"
            aria-label="Buscar contactos"
          />
        </div>
        <Select
          value={tagId ?? ALL_TAGS}
          onValueChange={(v) => {
            setLoading(true);
            setPage(0);
            setTagId(v === ALL_TAGS ? null : v);
          }}
        >
          <SelectTrigger className="w-48" aria-label="Filtrar por etiqueta">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={ALL_TAGS}>Todas las etiquetas</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <TagChip tag={t} size="xs" />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="ml-auto text-sm text-muted-foreground">
          {loading ? " " : `${total} contacto${total === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!loading && rows.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchXIcon}
              title="Ningún contacto coincide"
              description="Prueba con otra búsqueda o quita el filtro de etiqueta."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchInput("");
                    setTagId(null);
                  }}
                >
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="contactos"
              title="Aún no hay contactos"
              description="Los contactos se crean solos cuando alguien escribe a tu número de WhatsApp Business."
            />
          )
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <SortableHead label="Contacto" column="name" sort={sort} onSort={changeSort} />
                <SortableHead label="Empresa" column="company" sort={sort} onSort={changeSort} className="hidden lg:table-cell" />
                <TableHead className="hidden md:table-cell">Correo</TableHead>
                <TableHead>Etiquetas</TableHead>
                <SortableHead label="Actualizado" column="updated_at" sort={sort} onSort={changeSort} className="hidden sm:table-cell" />
                <TableHead className="w-12">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)
                : rows.map((row) => (
                    <TableRow key={row.id} className="cursor-pointer" onClick={() => setOpenId(row.id)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ContactAvatar seed={row.wa_id} name={row.name} company={row.company} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.name || "Sin nombre"}</p>
                            <p className="text-xs text-muted-foreground">{formatPhone(row.wa_id)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{row.company || "—"}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{row.email || "—"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex max-w-xs flex-wrap items-center gap-1">
                          {row.tags.map((t) => (
                            <TagChip key={t.id} tag={t} size="xs" />
                          ))}
                          <TagPicker
                            contactId={row.id}
                            value={row.tags}
                            onChange={(tags) => updateRow({ ...row, tags })}
                            trigger={
                              <Button variant="ghost" size="icon-xs" className="rounded-full" aria-label="Editar etiquetas">
                                <Icon name="agregar" />
                              </Button>
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(row.updated_at)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {row.conversationId && (
                          <Button variant="ghost" size="icon-sm" asChild>
                            <Link href={`/?c=${row.conversationId}`} aria-label="Abrir conversación">
                              <Icon name="bandeja" />
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </div>

      {total > PAGE_SIZE && (
        <footer className="flex items-center justify-between gap-2 border-t px-4 py-2 text-sm md:px-6">
          <span className="text-muted-foreground">
            {from}–{to} de {total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || loading}
              onClick={() => {
                setLoading(true);
                setPage((p) => p - 1);
              }}
            >
              <ChevronLeftIcon /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={to >= total || loading}
              onClick={() => {
                setLoading(true);
                setPage((p) => p + 1);
              }}
            >
              Siguiente <ChevronRightIcon />
            </Button>
          </div>
        </footer>
      )}

      <Sheet open={open !== null} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Detalle del contacto</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {open && (
              <ContactDetails
                key={open.id}
                contact={open}
                onContactChange={updateRow}
                actions={
                  open.conversationId ? (
                    <Button size="sm" asChild>
                      <Link href={`/?c=${open.conversationId}`}>
                        <Icon name="bandeja" /> Abrir conversación
                      </Link>
                    </Button>
                  ) : null
                }
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SortableHead({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string;
  column: SortColumn;
  sort: { column: SortColumn; ascending: boolean };
  onSort: (column: SortColumn) => void;
  className?: string;
}) {
  const active = sort.column === column;
  const SortIcon = sort.ascending ? ArrowUpIcon : ArrowDownIcon;
  return (
    <TableHead className={className} aria-sort={active ? (sort.ascending ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
      >
        {label}
        <SortIcon className={cn("size-3.5", !active && "opacity-0")} aria-hidden />
      </button>
    </TableHead>
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
      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-36" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell />
    </TableRow>
  );
}
