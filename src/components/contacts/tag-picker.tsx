"use client";

import { CheckIcon, TagIcon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useCrm } from "@/components/crm/crm-provider";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setCompanyTag } from "@/lib/crm/companies";
import { errorMessage, setContactTag } from "@/lib/crm/contacts";
import { TAG_COLORS, type Tag } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";

type Props = {
  /** De quién son las etiquetas: un contacto o una empresa (mismo catálogo). */
  target: { kind: "contact" | "company"; id: string };
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  trigger?: ReactNode;
  align?: "start" | "end";
};

/** Selector de etiquetas de un contacto o empresa: marca/desmarca y permite crear nuevas. */
export function TagPicker({ target, value, onChange, trigger, align = "start" }: Props) {
  const supabase = createClient();
  const { tags, reloadTags } = useCrm();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedIds = new Set(value.map((t) => t.id));
  const trimmed = search.trim();
  const exists = tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());

  async function toggle(tag: Tag) {
    const on = !selectedIds.has(tag.id);
    const next = on ? [...value, tag] : value.filter((t) => t.id !== tag.id);
    onChange(next.sort((a, b) => a.name.localeCompare(b.name, "es")));
    try {
      if (target.kind === "contact") await setContactTag(supabase, target.id, tag.id, on);
      else await setCompanyTag(supabase, target.id, tag.id, on);
    } catch (error) {
      onChange(value); // revertir
      toast.error(errorMessage(error, "No se pudo actualizar la etiqueta"));
    }
  }

  async function create() {
    if (!trimmed) return;
    // Color rotativo según cuántas etiquetas existen (se puede cambiar en /etiquetas).
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    const { data, error } = await supabase.from("tags").insert({ name: trimmed, color }).select("*").single();
    if (error) {
      toast.error(errorMessage(error, "No se pudo crear la etiqueta"));
      return;
    }
    setSearch("");
    void reloadTags();
    await toggle(data);
    toast.success(`Etiqueta «${data.name}» creada`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <TagIcon /> Etiquetas
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align={align}>
        <Command>
          <CommandInput placeholder="Buscar o crear etiqueta…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">
              {trimmed ? "Sin coincidencias" : "Aún no hay etiquetas"}
            </CommandEmpty>
            <CommandGroup>
              {tags.map((tag) => (
                <CommandItem key={tag.id} value={tag.name} onSelect={() => void toggle(tag)}>
                  <TagChip tag={tag} size="xs" />
                  <CheckIcon className={selectedIds.has(tag.id) ? "ml-auto" : "ml-auto invisible"} />
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmed && !exists && (
              <CommandGroup forceMount>
                <CommandItem value={`__crear__${trimmed}`} onSelect={() => void create()} forceMount>
                  <Icon name="agregar" /> Crear «{trimmed}»
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
