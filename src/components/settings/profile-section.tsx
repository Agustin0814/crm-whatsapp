"use client";

import { CheckIcon, KeyRoundIcon, LogOutIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { EditableField } from "@/components/contacts/editable-field";
import { UserAvatar } from "@/components/crm/contact-avatar";
import { profileName, useCrm } from "@/components/crm/crm-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AVATAR_PALETTE_SIZE, graphemes } from "@/lib/crm/avatar";
import { errorMessage } from "@/lib/crm/contacts";
import { passwordError, updatePasswordErrorMessage } from "@/lib/password";
import { ROLE_LABELS, isAdminRole, isRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PasswordFields } from "./password-fields";
import { SectionHeader } from "./section-header";

const COLORS = Array.from({ length: AVATAR_PALETTE_SIZE }, (_, i) => i + 1);

/** Mi perfil: nombre, avatar (color o emoji) y contraseña. Rol y puesto los cambia un administrador. */
export function ProfileSection() {
  const supabase = createClient();
  const { me, loading, reloadProfiles } = useCrm();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function saveProfile(patch: { full_name?: string | null; avatar_color?: number | null; avatar_emoji?: string | null }, ok: string) {
    if (!me) return;
    // Con la sesión del usuario: el trigger solo le deja cambiar nombre y avatar.
    const { error } = await supabase.from("profiles").update(patch).eq("id", me.id);
    if (error) {
      toast.error(errorMessage(error, "No se pudo guardar"));
      throw error;
    }
    toast.success(ok);
    await reloadProfiles();
  }

  return (
    <section className="space-y-6">
      <SectionHeader title="Perfil" description="Así te verá tu equipo al asignar conversaciones y en las notas internas." />
      {loading || !me ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <div className="flex flex-col gap-6 rounded-xl border p-5 sm:flex-row sm:items-start">
          <UserAvatar user={me} size="xl" />
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold">{profileName(me)}</p>
              <Badge variant={isAdminRole(me.role) ? "default" : "secondary"}>
                {isRole(me.role) ? ROLE_LABELS[me.role] : me.role}
              </Badge>
              {me.job_title && <span className="text-sm text-texto-suave">· {me.job_title}</span>}
            </div>
            <EditableField
              icon="persona"
              label="Nombre"
              value={me.full_name}
              placeholder="Tu nombre"
              onSave={(v) => saveProfile({ full_name: v }, "Nombre actualizado")}
            />
            <div className="flex items-start gap-3">
              <Icon name="correo" className="mt-1 size-5 text-texto-suave" />
              <div>
                <p className="text-xs font-medium text-texto-suave">Correo</p>
                <p className="text-sm">{email ?? " "}</p>
              </div>
            </div>
            <AvatarPicker
              color={me.avatar_color}
              emoji={me.avatar_emoji}
              onChange={(patch) => void saveProfile(patch, "Avatar actualizado").catch(() => {})}
            />
          </div>
        </div>
      )}

      <PasswordSection />

      <Button variant="outline" onClick={() => void createClient().auth.signOut()}>
        <LogOutIcon aria-hidden /> Cerrar sesión
      </Button>
    </section>
  );
}

function AvatarPicker({
  color,
  emoji,
  onChange,
}: {
  color: number | null;
  emoji: string | null;
  onChange: (patch: { avatar_color?: number | null; avatar_emoji?: string | null }) => void;
}) {
  const [emojiDraft, setEmojiDraft] = useState(emoji ?? "");

  function saveEmoji() {
    // Solo el primer grafema (un emoji compuesto cuenta como uno).
    const value = graphemes(emojiDraft.trim())[0] ?? "";
    setEmojiDraft(value);
    if ((value || null) !== (emoji || null)) onChange({ avatar_emoji: value || null });
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-texto-suave">Avatar</legend>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Color del avatar">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={`Color ${c}`}
            onClick={() => onChange({ avatar_color: color === c ? null : c })}
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-white transition-transform focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:hover:scale-105",
              color === c && "ring-2 ring-texto ring-offset-2 ring-offset-background",
            )}
            style={{ backgroundColor: `var(--avatar-${c})` }}
          >
            {color === c && <CheckIcon className="size-4" aria-hidden />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="avatar-emoji" className="text-sm font-normal">
          Emoji (opcional)
        </Label>
        <Input
          id="avatar-emoji"
          value={emojiDraft}
          onChange={(e) => setEmojiDraft(e.target.value)}
          onBlur={saveEmoji}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveEmoji())}
          className="h-9 w-20 text-center text-lg"
          placeholder="🙂"
          maxLength={16}
        />
        {emoji && (
          <Button type="button" variant="ghost" size="sm" onClick={() => (setEmojiDraft(""), onChange({ avatar_emoji: null }))}>
            Quitar emoji
          </Button>
        )}
      </div>
    </fieldset>
  );
}

function PasswordSection() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = passwordError(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updatePasswordErrorMessage(updateError));
      return;
    }
    setPassword("");
    setConfirm("");
    toast.success("Contraseña actualizada");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <KeyRoundIcon className="size-5 text-texto-suave" aria-hidden />
        <h3 className="font-semibold">Cambiar contraseña</h3>
      </div>
      <div className="max-w-sm">
        <PasswordFields
          idPrefix="perfil-clave"
          password={password}
          confirm={confirm}
          onPasswordChange={setPassword}
          onConfirmChange={setConfirm}
          invalid={Boolean(error)}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error-texto">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving || !password}>
        {saving ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
