@AGENTS.md

# CRM WhatsApp Business

CRM propio para administrar los mensajes de WhatsApp Business. Responder y comentar el código en español.

## Stack
- Next.js 16 (App Router, TypeScript estricto, `src/`), Tailwind CSS v4 y shadcn/ui (Radix, estilo "nova", `components.json`).
  - Esta versión de Next tiene cambios importantes: `middleware` ahora es `proxy` (`src/proxy.ts`) y `cacheComponents` está activo. Leer `node_modules/next/dist/docs/` antes de usar una API nueva.
  - Con `cacheComponents`, las páginas son estáticas y los datos se cargan en el cliente con la sesión del usuario. Un componente que use `useSearchParams` va dentro de `<Suspense>`.
- Supabase: Postgres, Auth (correo y contraseña), Realtime y Storage. Paquetes: `@supabase/ssr` y `@supabase/supabase-js`.
- WhatsApp Cloud API de Meta: `https://graph.facebook.com/v25.0`.
- Hosting en Vercel.
- No instalar dependencias pesadas sin necesidad. Componentes nuevos de shadcn: `npx shadcn@latest add <nombre>`.
- Lint estricto (`react-hooks/set-state-in-effect`, `purity`): en efectos, actualizar estado solo en callbacks (`.then`, eventos, timers), no de forma síncrona.

## Reglas de WhatsApp
- El webhook (`src/app/api/whatsapp/webhook/route.ts`) responde 200 de inmediato y procesa después con `after()`, porque Meta reintenta si tarda.
- Validar siempre la firma `X-Hub-Signature-256` (HMAC SHA-256 con `WHATSAPP_APP_SECRET`, comparación en tiempo constante) sobre el body crudo.
- Deduplicar mensajes con `messages.wa_message_id` (columna única): insertar con `ON CONFLICT DO NOTHING`.
- Ventana de 24 h: solo se puede escribir texto libre dentro de las 24 h posteriores al último mensaje del cliente (`conversations.last_inbound_at`). Fuera de la ventana se necesita una plantilla aprobada; la interfaz debe avisarlo y bloquear el texto libre, y el servidor debe validarlo también (`src/lib/conversation-window.ts`).
- México: al enviar, `toSendableNumber()` (`src/lib/whatsapp/send.ts`) convierte `521XXXXXXXXXX` en `52XXXXXXXXXX` solo en el campo `to`. `contacts.wa_id` nunca se modifica.
- El webhook solo completa `contacts.name` si está vacío: el nombre editado en el CRM no se pisa.

## Base de datos (Supabase, RLS activado)
Tablas: `profiles`, `contacts`, `conversations`, `messages`, `tags`, `contact_tags`, `notes`, `quick_replies`.
- Los tipos están en `src/lib/supabase/database.types.ts` (regenerarlos con `generate_typescript_types` si cambia el esquema). Revisar el esquema real antes de escribir queries.
- Cambios de esquema solo con migraciones (`apply_migration`) y después `get_advisors` (seguridad y rendimiento).
- El trigger `messages_touch_conversation` (AFTER INSERT en `messages`) actualiza `last_message_at`, `last_message_preview`, `last_inbound_at` y `unread_count` de `conversations`. **No repetir esa lógica en el código.**
- `messages.status`: `received | sending | sent | delivered | read | failed`. `messages.direction`: `inbound | outbound`.
- `conversations.status`: `open | pending | resolved | archived` (etiquetas en `src/lib/crm/types.ts`).
- Una conversación por contacto (`conversations.contact_id` es único).
- `contacts.updated_at` se actualiza solo (trigger `contacts_set_updated_at`).
- Realtime publica `messages`, `conversations` y `notes`.
- El trigger también guarda `conversations.last_message_type` (icono de la vista previa) y usa etiquetas en español para mensajes sin texto («Imagen», «Audio», «Video», «Documento», «Sticker», «Mensaje»); si hay leyenda, la vista previa es la leyenda.

### Roles y RLS (migración `crm_roles_y_politicas`)
- `profiles.role`: `admin | agent`. Helper `private.is_admin()` (esquema `private`, no expuesto por la API).
- Solo admin: cambiar roles (trigger `profiles_protect_role`; además impide quedarse sin admins), eliminar etiquetas, crear/editar/borrar respuestas rápidas, gestionar usuarios.
- Todos los autenticados: leer y editar contactos, conversaciones, mensajes, etiquetas (sin borrar) y notas propias. Las notas las edita o borra su autor o un admin.
- Las restricciones viven en la base; la interfaz solo oculta o deshabilita botones.

### Búsqueda (migración `crm_busqueda_e_indices`)
- `public.search_conversations(...)` (SECURITY INVOKER, respeta RLS): filtros por texto (nombre, correo, empresa, teléfono por dígitos y texto de mensajes con el índice GIN `spanish` y prefijos), estados (null = todas menos archivadas), etiquetas (cualquiera de), agente, sin asignar, no leídas, rango de fechas de `last_message_at`, y `p_conversation_id` para comprobar si UNA conversación cumple los filtros (Realtime). Paginación `p_limit`/`p_offset`. Orden: fijadas y luego `last_message_at desc`.
- Se usa con embedding: `supabase.rpc("search_conversations", args).select(CONVERSATION_SELECT)` (`src/lib/crm/conversations.ts`).
- Índices trigram (`pg_trgm`) en `contacts.name` y `contacts.wa_id`, e índice de orden de la bandeja.

### Multimedia (migración `crm_multimedia`)
- Bucket PRIVADO `whatsapp-media` (50 MB por archivo, límite del plan gratuito). Rutas: `inbound/{conversation_id}/{message_id}.{ext}` (solo el servidor, con service role) y `outbound/{user_id}/{uuid}.{ext}` (cada usuario solo en su carpeta, política `whatsapp_media_insert_outbound`). Todos los autenticados pueden leer (para pedir URLs firmadas). Sin UPDATE/DELETE para usuarios.
- `messages`: `media_filename`, `media_size`, `media_status` (`pending | ready | failed`, null si no hay archivo) y `media_error`.
- **Nunca subir archivos a través de rutas de Next** (Vercel limita el cuerpo a ~4.5 MB): el navegador sube directo a Storage con una URL firmada de subida (`src/lib/media/upload.ts`, XHR para el progreso) y el servidor solo recibe la ruta.
- Recibir: el webhook guarda el mensaje con `media_status = pending` y, dentro del `after()`, descarga de Meta (GET /{media_id} → URL temporal → GET con el token) y sube a Storage (`src/lib/whatsapp/media.ts`, `storeInboundMedia`, nunca lanza). Las reacciones se ignoran. Los tipos no multimedia se guardan con un body descriptivo y se muestran como «Mensaje no compatible (tipo)».
- `GET /api/media/[messageId]`: URL firmada de 60 min bajo demanda (nunca se guarda en la base). Si el archivo está `failed` o `pending` viejo y es entrante, reintenta la descarga de Meta (los medios viven ~30 días allí). Los documentos siempre se firman con descarga forzada.
- Enviar: `POST /api/whatsapp/send-media` (sesión, ruta propia, ventana de 24 h, tipo REAL y tamaño, subida a Meta `/{phone}/media`, envío con `toSendableNumber`). Si Meta rechaza o el tipo es inválido, el servidor borra la subida.
- Reglas y límites compartidos cliente/servidor en `src/lib/media/rules.ts`: el tipo se detecta por los primeros bytes (`detectMime`), nunca por la extensión; nombres saneados (`sanitizeFilename`); HTML/SVG/XML se guardan como `application/octet-stream`.
- Fuera de alcance por ahora: grabar notas de voz en el navegador, plantillas y envíos masivos.

## Estructura de la app
- `src/app/(crm)/`: rutas protegidas con layout común (navegación lateral + proveedores). Páginas: `/` (Bandeja, `?c=<id>` abre una conversación), `/contactos`, `/estadisticas` (provisional, «Próximamente») y `/configuracion?tab=perfil|usuarios|notificaciones|apariencia|etiquetas|respuestas-rapidas`. `/ajustes`, `/etiquetas` y `/respuestas-rapidas` redirigen ahí (`next.config.ts`).
- `src/components/crm/`: `CrmProvider` (usuario actual, perfiles y etiquetas: `useCrm()`), `NotificationsProvider` (sonido MP3 con desbloqueo tras la primera interacción y máximo uno por segundo, contador en el título, notificaciones del navegador y estado REAL de Realtime: `useNotifications()`), `AppShell` (barra lateral oscura contraída en lg y expandida en xl, barra inferior en móvil/tablet: `useShell()`), avatar, chips, estados vacíos.
- Avatares: lógica única en `src/lib/crm/avatar.ts` (`avatarFor`): emoji inicial completo, icono «empresa» si hay empresa, iniciales o icono «persona». Recorrer nombres por grafemas (`Intl.Segmenter`), nunca con `name[0]`.
- `src/components/inbox/`: bandeja (`inbox.tsx` orquesta el estado, Realtime y el layout adaptable), lista con filtros y scroll infinito, chat (botón «notas» alterna con las notas internas), composer con ventana de 24 h, chips y menú «/» de respuestas rápidas, emojis y adjuntos (selector, arrastrar y soltar, pegar). Multimedia en `src/components/inbox/media/` (URL firmada perezosa con `useMediaUrl`, visor, reproductor de audio, documentos solo descargables).
- `src/components/contacts/`: ficha editable (`ContactDetails`, guardado automático al salir del campo), selector de etiquetas, tabla de contactos.
- `src/lib/crm/`: tipos, consultas, filtros, plantillas (`{{nombre}}`, `{{primer_nombre}}`, `{{telefono}}`, `{{empresa}}`).
- `src/app/api/admin/users`: listar, crear y eliminar usuarios (verifica sesión y rol con `requireAdmin()` antes de usar la service role).

## Diseño
- Marca: naranja `#EC5E2A` (token `--marca`). Con texto blanco usar `--marca-fuerte` (AA); texto naranja: `--marca-texto`; fondos de selección: `--marca-suave`. Todos los pares de tokens están verificados con contraste AA (los valores están comentados en `globals.css`).
- Todos los colores son tokens en `src/app/globals.css` con nombres en español (`superficie`, `borde`, `texto(-suave)`, `exito`, `advertencia`, `error`, `lateral-*`, `burbuja-*`, `nota-*`, `avatar-1..8`) y alias de shadcn (`primary` = `marca-fuerte`, etc.). No usar colores sueltos de Tailwind. Única excepción: el color de cada etiqueta (`tags.color`), mezclado con `--etiqueta-texto-base` para asegurar contraste.
- Barra lateral siempre oscura (`--lateral`); área de trabajo clara por defecto, con oscuro y sistema.
- Medidas: `--lateral-ancho`, `--lateral-ancho-mini`, `--lista-ancho`, `--ficha-ancho`, `--barra-inferior-alto` (se usan como `w-(--lista-ancho)`). Breakpoints: < 1024 px una columna con barra inferior; ≥ 1024 lista + chat; ≥ 1536 además la ficha como columna (antes, panel deslizante).
- Iconos: `<Icon name="…" />` (`src/components/ui/icon.tsx`) dibuja inline los SVG de `public/icons` con `currentColor`; regenerar con `npm run iconos`. Sin equivalente, lucide-react con el mismo tamaño y grosor. Botones de solo icono: `IconButton` (aria-label + tooltip).
- Logos (`src/lib/brand.ts`): sus nombres están AL REVÉS de lo que sugieren. `logo-lg-blocks-oscuro.svg` tiene el texto blanco (fondos oscuros) y `logo-lg-blocks-claro.svg` el texto oscuro (fondos claros); en el código se llaman `logoFondoOscuro` / `logoFondoClaro`. Son PNG en base64 dentro de SVG: cargar con `<img>` sin optimizar y nunca dos versiones a la vez.
- Los archivos de `public/brand`, `public/icons` y `public/sounds` son originales: no modificarlos.
- Toasts con `sonner`, skeletons mientras carga, `EmptyState` (vacío o `tone="error"` con «Reintentar»). Se respeta `prefers-reduced-motion`.

## Secretos y clientes de Supabase
- Nunca poner secretos en el código ni en logs (ni tokens, ni payloads completos, ni correos o contraseñas de usuarios). Todo va en `.env.local`, que no se muestra ni se sube a git.
- Variables: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `src/lib/supabase/admin.ts` usa `SUPABASE_SERVICE_ROLE_KEY`: solo del lado del servidor (webhook, descarga de medios entrantes, limpieza de subidas descartadas y `/api/admin/*` después de `requireAdmin()`). Nunca importarlo desde componentes cliente.
- `src/lib/supabase/server.ts`: cliente con la sesión del usuario (route handlers / server components).
- `src/lib/supabase/client.ts`: cliente del navegador (respeta RLS). Todas las acciones del usuario van por aquí o por rutas que verifican sesión y rol.
