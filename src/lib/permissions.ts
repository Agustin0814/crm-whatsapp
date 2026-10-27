// Permisos por rol, compartidos por cliente y servidor (lógica pura).
// La base los vuelve a aplicar con RLS y los helpers de `private`
// (my_role, is_admin, is_seller_or_admin, is_delivery, can_see_conversation):
// aquí solo se decide qué se muestra y qué rutas se permiten.

export const ROLES = ["superadmin", "admin", "vendedor", "repartidor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Proveedor",
  admin: "Administrador",
  vendedor: "Vendedor",
  repartidor: "Repartidor",
};

/** Roles que un administrador puede asignar (el superadmin se asigna por SQL). */
export const ASSIGNABLE_ROLES = ["vendedor", "repartidor", "admin"] as const satisfies readonly Role[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

/** admin y superadmin pueden todo lo que es «solo admin». */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

/** Vendedor o administración: ven todos los chats y contactos. */
export function isSellerOrAdmin(role: string | null | undefined): boolean {
  return role === "vendedor" || isAdminRole(role);
}

export function isDeliveryRole(role: string | null | undefined): boolean {
  return role === "repartidor";
}

// --- Acciones de etapa -------------------------------------------------------

/** Tomar un chat sin asignar o pasarlo a reparto: vendedor y administración. */
export function canMoveToSalesOrDelivery(role: string | null | undefined): boolean {
  return isSellerOrAdmin(role);
}

/** Marcar entregado o devolver a ventas: cualquier rol activo. */
export function canCloseDelivery(role: string | null | undefined): boolean {
  return isRole(role);
}

// --- Rutas -------------------------------------------------------------------

/**
 * ¿Puede el rol abrir esta ruta de página? La usa el proxy (servidor) y el menú.
 * Las rutas de API validan su propio permiso.
 */
export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  if (!isRole(role)) return false;
  const section = "/" + (pathname.split("/")[1] ?? "");
  switch (section) {
    case "/":
    case "/configuracion": // Mi perfil, notificaciones y apariencia son de todos
      return true;
    case "/contactos":
    case "/asistente":
      return isSellerOrAdmin(role);
    case "/agentes":
    case "/estadisticas":
      return isAdminRole(role);
    default:
      return true;
  }
}

/** Pestañas de Configuración que no son de administración. */
export const PERSONAL_SETTINGS_TABS = ["perfil", "notificaciones", "apariencia"] as const;
