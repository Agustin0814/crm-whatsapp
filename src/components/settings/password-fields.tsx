"use client";

import { CheckIcon, CircleIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordRules } from "@/lib/password";
import { cn } from "@/lib/utils";

/**
 * Nueva contraseña + confirmación con la lista de requisitos y un botón para
 * mostrar u ocultar ambas (Mi perfil, recuperar contraseña y activar cuenta).
 */
export function PasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  idPrefix,
  invalid,
  autoFocus,
}: {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  idPrefix: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const rules = passwordRules(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const type = visible ? "text" : "password";

  const toggle = (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-texto-suave hover:text-texto focus-visible:ring-2 focus-visible:ring-marca focus-visible:outline-none"
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={visible}
    >
      {visible ? <EyeOffIcon className="size-4" aria-hidden /> : <EyeIcon className="size-4" aria-hidden />}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-nueva`}>Nueva contraseña</Label>
        <div className="relative">
          <Input
            id={`${idPrefix}-nueva`}
            type={type}
            autoComplete="new-password"
            required
            autoFocus={autoFocus}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={`${idPrefix}-reglas`}
            className="h-11 pr-11"
          />
          {toggle}
        </div>
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
        <div className="relative">
          <Input
            id={`${idPrefix}-confirmar`}
            type={type}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => onConfirmChange(e.target.value)}
            aria-invalid={invalid || mismatch ? true : undefined}
            aria-describedby={mismatch ? `${idPrefix}-no-coincide` : undefined}
            className="h-11 pr-11"
          />
        </div>
        {mismatch && (
          <p id={`${idPrefix}-no-coincide`} className="text-xs text-error-texto">
            Las contraseñas no coinciden.
          </p>
        )}
      </div>
    </div>
  );
}
