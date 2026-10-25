"use client";

import { CheckIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { TagChip } from "@/components/crm/tag-chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isHexColor, TAG_COLORS, type Tag } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Etiqueta a editar; null para crear una nueva. */
  tag: Tag | null;
  onSubmit: (values: { name: string; color: string }) => Promise<boolean>;
};

/** Formulario de etiqueta. Se monta con key para reiniciar el estado al abrir. */
export function TagDialog({ open, onOpenChange, tag, onSubmit }: Props) {
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? TAG_COLORS[6]);
  const [saving, setSaving] = useState(false);
  const validColor = isHexColor(color);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !validColor) return;
    setSaving(true);
    const ok = await onSubmit({ name: name.trim(), color: color.toLowerCase() });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{tag ? "Editar etiqueta" : "Nueva etiqueta"}</DialogTitle>
            <DialogDescription>Las etiquetas ayudan a clasificar contactos y filtrar la bandeja.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="tag-name">Nombre</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Ej. Cliente VIP"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background",
                    color.toLowerCase() === c && "ring-2 ring-ring",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                  aria-pressed={color.toLowerCase() === c}
                >
                  {color.toLowerCase() === c && <CheckIcon className="size-4 text-white" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={validColor ? color : "#6b7280"}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border bg-transparent"
                aria-label="Color personalizado"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-28 font-mono"
                aria-label="Código hexadecimal"
                aria-invalid={!validColor || undefined}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <span className="text-xs text-muted-foreground">Vista previa:</span>
            <TagChip tag={{ name: name.trim() || "Etiqueta", color: validColor ? color : "#6b7280" }} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !name.trim() || !validColor}>
              {tag ? "Guardar cambios" : "Crear etiqueta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
