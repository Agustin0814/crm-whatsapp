import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

/** Encabezado de las páginas secundarias (Contactos, Estadísticas, Configuración). */
export function PageHeader({ title, description, actions }: Props) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b bg-background px-4 py-4 md:px-6">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-texto-suave">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
