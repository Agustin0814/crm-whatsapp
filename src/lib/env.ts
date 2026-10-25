import "server-only";

type ServerEnvName =
  | "WHATSAPP_TOKEN"
  | "WHATSAPP_PHONE_NUMBER_ID"
  | "WHATSAPP_BUSINESS_ACCOUNT_ID"
  | "WHATSAPP_VERIFY_TOKEN"
  | "WHATSAPP_APP_SECRET"
  | "SUPABASE_SERVICE_ROLE_KEY";

/**
 * Lee una variable de entorno del servidor y falla si no existe.
 * El mensaje de error solo incluye el nombre, nunca el valor.
 */
export function serverEnv(name: ServerEnvName): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}
