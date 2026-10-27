"use client";

import { CheckIcon, CircleIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordRules } from "@/lib/password";
import { cn } from "@/lib/utils";

/** Nueva contraseña + confirmación con la lista de requisitos (Mi perfil y definir contraseña). */
export function PasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  idPrefix,
  invalid,
}: {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  idPrefix: string;
  invalid?: boolean;
}) {
  const rules = passwordRules(password);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-nueva`}>Nueva contraseña</Label>
        <Input
          id={`${idPrefix}-nueva`}
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={`${idPrefix}-reglas`}
          className="h-11"
        />
        <ul id={`${idPrefix}-reglas`} className="space-y-1 text-xs" aria-label="Requisitos de la contraseña">
          {rules.map((rule) => (
            <li key={rule.id} className={cn("flex items-center gap-1.5", rule.ok ? "text-exito-texto" : "text-texto-suave")}>
              {rule.ok ? <CheckIcon className="size-3.5" aria-hidden /> : <CircleIcon className="size-3" aria-hidden />}
              {rule.label}
              <span className="sr-only">{rule.ok ? "(cumplido)" : "(pendiente)"}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-confirmar`}>Confirmar contraseña</Label>
        <Input
          id={`${idPrefix}-confirmar`}
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => onConfirmChange(e.target.value)}
          aria-invalid={invalid ? true : undefined}
          className="h-11"
        />
      </div>
    </div>
  );
}
