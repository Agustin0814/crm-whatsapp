"use client";

import { useRef, useState, type FormEvent } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { applyTemplate, TEMPLATE_VARIABLES } from "@/lib/crm/templates";
import {
  isQuickReplyPermission,
  QUICK_REPLY_PERMISSION_LABELS,
  type QuickReplyPermission,
} from "@/lib/agents/config";
import type { QuickReply } from "@/lib/crm/types";

export type QuickReplyValues = {
  shortcut: string;
  body: string;
  when_to_use: string | null;
  agent_permission: QuickReplyPermission;
};

const PERMISSION_HINTS: Record<QuickReplyPermission, string> = {
  automatic: "El asistente puede enviarla solo.",
  approval: "El asistente la propone y una persona la aprueba.",
  human_only: "El asistente nunca la usa.",
};

/** Contacto de ejemplo para la vista previa. */
const SAMPLE_CONTACT = { name: "Ana López", wa_id: "5215512345678", phone: "5215512345678", company: "Acme" };

const SHORTCUT_RE = /^[a-z0-9_-]{1,30}$/;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reply: QuickReply | null;
  onSubmit: (values: QuickReplyValues) => Promise<boolean>;
};

export function QuickReplyDialog({ open, onOpenChange, reply, onSubmit }: Props) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [shortcut, setShortcut] = useState(reply?.shortcut ?? "");
  const [body, setBody] = useState(reply?.body ?? "");
  const [whenToUse, setWhenToUse] = useState(reply?.when_to_use ?? "");
  const [permission, setPermission] = useState<QuickReplyPermission>(
    isQuickReplyPermission(reply?.agent_permission) ? reply.agent_permission : "human_only",
  );
  const [saving, setSaving] = useState(false);
  const shortcutValid = SHORTCUT_RE.test(shortcut);

  function insertVariable(key: string) {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shortcutValid || !body.trim()) return;
    setSaving(true);
    const ok = await onSubmit({
      shortcut,
      body: body.trim(),
      when_to_use: whenToUse.trim() || null,
      agent_permission: permission,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{reply ? "Editar respuesta rápida" : "Nueva respuesta rápida"}</DialogTitle>
            <DialogDescription>
              En el chat, escribe «/» seguido del atajo para insertar el texto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="qr-shortcut">Atajo</Label>
            <div className="flex items-center gap-1">
              <span className="font-mono text-muted-foreground">/</span>
              <Input
                id="qr-shortcut"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                placeholder="saludo"
                className="font-mono"
                maxLength={30}
                aria-invalid={(shortcut !== "" && !shortcutValid) || undefined}
                autoFocus
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">Minúsculas, números, guiones y guion bajo.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qr-body">Texto</Label>
            <Textarea
              id="qr-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={4096}
              placeholder="¡Hola {{nombre}}! Gracias por escribirnos."
              required
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Variables:</span>
              {TEMPLATE_VARIABLES.map((v) => (
                <Button
                  key={v.key}
                  type="button"
                  variant="secondary"
                  size="xs"
                  className="font-mono"
                  title={v.description}
                  onClick={() => insertVariable(v.key)}
                >
                  {`{{${v.key}}}`}
                </Button>
              ))}
            </div>
          </div>

          {body.trim() && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Vista previa (con un contacto de ejemplo)</p>
              <p className="rounded-2xl rounded-tr-sm bg-burbuja-saliente px-3 py-2 text-sm whitespace-pre-wrap text-burbuja-saliente-texto">
                {applyTemplate(body, SAMPLE_CONTACT)}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qr-when">Cuándo usarla</Label>
              <Textarea
                id="qr-when"
                value={whenToUse}
                onChange={(e) => setWhenToUse(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Cuando pregunten por el horario"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-permission">Permiso del agente</Label>
              <Select value={permission} onValueChange={(v) => isQuickReplyPermission(v) && setPermission(v)}>
                <SelectTrigger id="qr-permission" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {(Object.keys(QUICK_REPLY_PERMISSION_LABELS) as QuickReplyPermission[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {QUICK_REPLY_PERMISSION_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{PERMISSION_HINTS[permission]}</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !shortcutValid || !body.trim()}>
              {reply ? "Guardar cambios" : "Crear respuesta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
