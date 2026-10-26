"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createCompany, searchCompanies, type Company } from "@/lib/crm/companies";
import { errorMessage } from "@/lib/crm/contacts";
import { createClient } from "@/lib/supabase/client";

type Option = Pick<Company, "id" | "trade_name" | "legal_name" | "city">;

type Props = {
  /** Empresas que no se ofrecen (p. ej. las ya vinculadas). */
  excludeIds?: string[];
  onSelect: (company: Pick<Company, "id" | "trade_name">) => void | Promise<void>;
  trigger?: ReactNode;
  align?: "start" | "end";
};

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Busca una empresa por nombre comercial o razón social. Si no existe, se
 * crea al vuelo solo con el nombre; el resto se completa en su ficha.
 */
export function CompanyPicker({ excludeIds = [], onSelect, trigger, align = "start" }: Props) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      searchCompanies(supabase, search)
        .then((rows) => {
          if (!cancelled) setOptions(rows);
        })
        .catch((error) => toast.error(errorMessage(error, "No se pudieron buscar empresas")))
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [supabase, search, open]);

  const trimmed = search.trim().replace(/\s+/g, " ");
  const exact = options.some((o) => o.trade_name.toLowerCase() === trimmed.toLowerCase());
  const visible = options.filter((o) => !excludeIds.includes(o.id));

  async function choose(company: Pick<Company, "id" | "trade_name">) {
    setBusy(true);
    try {
      await onSelect(company);
      setOpen(false);
      setSearch("");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!trimmed) return;
    setBusy(true);
    try {
      const company = await createCompany(supabase, { trade_name: trimmed });
      toast.success(`Empresa «${company.trade_name}» creada`);
      await onSelect(company);
      setOpen(false);
      setSearch("");
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      toast.error(code === "23505" ? `Ya existe una empresa llamada «${trimmed}»` : errorMessage(error, "No se pudo crear la empresa"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Icon name="empresa" /> Vincular a empresa
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align={align}>
        {/* El filtrado lo hace la base: cmdk no vuelve a filtrar */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar o crear empresa…" value={search} onValueChange={setSearch} />
          <CommandList>
            {!(trimmed && !exact && !loading) && (
              <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">
                {loading ? "Buscando…" : trimmed ? "Sin coincidencias" : "Aún no hay empresas"}
              </CommandEmpty>
            )}
            {visible.length > 0 && (
              <CommandGroup>
                {visible.map((o) => (
                  <CommandItem key={o.id} value={o.id} disabled={busy} onSelect={() => void choose(o)}>
                    <Icon name="empresa" className="text-texto-suave" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.trade_name}</span>
                      {(o.legal_name || o.city) && (
                        <span className="block truncate text-xs text-texto-suave">
                          {[o.legal_name, o.city].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {trimmed && !exact && !loading && (
              <CommandGroup forceMount>
                <CommandItem value="__crear__" disabled={busy} onSelect={() => void create()} forceMount>
                  <Icon name="agregar" /> Crear empresa «{trimmed}»
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
