"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ContactAvatar } from "@/components/crm/contact-avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { errorMessage } from "@/lib/crm/contacts";
import type { Contact } from "@/lib/crm/types";
import { formatPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Option = Pick<Contact, "id" | "name" | "wa_id" | "phone">;

type Props = {
  excludeIds?: string[];
  onSelect: (contact: Option) => void | Promise<void>;
  trigger?: ReactNode;
  align?: "start" | "end";
  placeholder?: string;
};

const SEARCH_DEBOUNCE_MS = 250;

/** Busca una persona por nombre o teléfono (para vincularla a una empresa). */
export function ContactPicker({ excludeIds = [], onSelect, trigger, align = "start", placeholder }: Props) {
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
      let query = supabase.from("contacts").select("id, name, wa_id, phone").order("name").limit(20);
      const term = search.trim().replace(/[%_,()]/g, " ");
      if (term) query = query.or(`name.ilike.%${term}%,wa_id.ilike.%${term}%,phone.ilike.%${term}%`);
      query.then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error(errorMessage(error, "No se pudieron buscar contactos"));
        setOptions(data ?? []);
        setLoading(false);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [supabase, search, open]);

  const visible = options.filter((o) => !excludeIds.includes(o.id));

  async function choose(contact: Option) {
    setBusy(true);
    try {
      await onSelect(contact);
      setOpen(false);
      setSearch("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Icon name="persona" /> Vincular persona
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align={align}>
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder ?? "Buscar por nombre o teléfono…"} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">
              {loading ? "Buscando…" : "Sin coincidencias"}
            </CommandEmpty>
            {visible.length > 0 && (
              <CommandGroup>
                {visible.map((o) => (
                  <CommandItem key={o.id} value={o.id} disabled={busy} onSelect={() => void choose(o)}>
                    <ContactAvatar seed={o.wa_id ?? o.id} name={o.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.name || "Sin nombre"}</span>
                      <span className="block truncate text-xs text-texto-suave tabular-nums">
                        {formatPhone(o.wa_id ?? o.phone)}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
