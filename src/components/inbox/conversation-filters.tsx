"use client";

import { profileName, useCrm } from "@/components/crm/crm-provider";
import { StatusDot } from "@/components/crm/status-badge";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { countAdvancedFilters, DEFAULT_FILTERS, type InboxFilters, type StatusFilter } from "@/lib/crm/conversations";
import { STATUS_LABELS } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

const ANY = "__cualquiera__";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Activas (sin archivadas)" },
  { value: "open", label: STATUS_LABELS.open },
  { value: "pending", label: STATUS_LABELS.pending },
  { value: "resolved", label: STATUS_LABELS.resolved },
  { value: "archived", label: STATUS_LABELS.archived },
  { value: "all", label: "Todos los estados" },
];

type Props = {
  filters: InboxFilters;
  onChange: (patch: Partial<InboxFilters>) => void;
};

/** Botón «filtros» con el panel de filtros combinables: estado, etiquetas, agente y fechas. */
export function ConversationFilters({ filters, onChange }: Props) {
  const { tags, profiles } = useCrm();
  const active = countAdvancedFilters(filters);
  const assigneeDisabled = filters.quick === "mine" || filters.quick === "unassigned";

  function toggleTag(id: string, checked: boolean) {
    onChange({ tagIds: checked ? [...filters.tagIds, id] : filters.tagIds.filter((t) => t !== id) });
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-lg"
              className={cn("relative shrink-0 text-texto-suave", active > 0 && "text-marca-texto")}
              aria-label={active > 0 ? `Filtros (${active} activos)` : "Filtros"}
            >
              <Icon name="filtros" className="size-5" />
              {active > 0 && (
                <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-marca-fuerte text-[0.625rem] font-semibold text-white">
                  {active}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Filtros</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Filtros</p>
          {active > 0 && (
            <Button
              variant="link"
              size="xs"
              className="h-auto p-0 text-marca-texto"
              onClick={() =>
                onChange({
                  status: DEFAULT_FILTERS.status,
                  tagIds: [],
                  assigneeId: null,
                  from: null,
                  to: null,
                })
              }
            >
              Limpiar
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-texto-suave">Estado</Label>
          <Select value={filters.status} onValueChange={(v) => onChange({ status: v as StatusFilter })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.value !== "active" && s.value !== "all" && <StatusDot status={s.value} />}
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium text-texto-suave">Etiquetas (cualquiera de)</legend>
          {tags.length === 0 ? (
            <p className="text-xs text-texto-suave">No hay etiquetas creadas.</p>
          ) : (
            <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {tags.map((tag) => (
                <label key={tag.id} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={filters.tagIds.includes(tag.id)}
                    onCheckedChange={(c) => toggleTag(tag.id, c === true)}
                  />
                  <TagChip tag={tag} size="xs" />
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="space-y-2">
          <Label className="text-xs text-texto-suave">Agente asignado</Label>
          <Select
            value={filters.assigneeId ?? ANY}
            onValueChange={(v) => onChange({ assigneeId: v === ANY ? null : v })}
            disabled={assigneeDisabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={ANY}>Cualquiera</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {profileName(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assigneeDisabled && (
            <p className="text-xs text-texto-suave">El filtro rápido seleccionado ya define la asignación.</p>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium text-texto-suave">Último mensaje entre</legend>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={filters.from ?? ""}
              max={filters.to ?? undefined}
              onChange={(e) => onChange({ from: e.target.value || null })}
              aria-label="Desde"
            />
            <Input
              type="date"
              value={filters.to ?? ""}
              min={filters.from ?? undefined}
              onChange={(e) => onChange({ to: e.target.value || null })}
              aria-label="Hasta"
            />
          </div>
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
