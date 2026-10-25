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
- El webhook obtiene el contacto con `rpc("upsert_whatsapp_contact")` (solo `service_role`): busca por `wa_id`; si no existe, vincula un contacto creado a mano con el mismo teléfono normalizado; si tampoco, lo crea. Solo completa `contacts.name` si está vacío: el nombre editado en el CRM no se pisa.
- `contacts.wa_id` puede ser null (contactos creados a mano sin WhatsApp): mostrar `wa_id ?? phone` y no permitir enviar mensajes a un contacto sin `wa_id`.

## Base de datos (Supabase, RLS activado)
Tablas: `profiles`, `contacts`, `conversations`, `messages`, `tags`, `contact_tags`, `notes`, `quick_replies`, y las de contactos y ventas (ver «Contactos, empresas y ventas»).
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

### Contactos, empresas y ventas (migraciones `crm_contactos_empresas`, `crm_pedidos_pagos_directorio`, `crm_saldos_sin_full_join`, `crm_fix_detectar_prospecto`, `crm_pedidos_definer_privado`)
- `contacts`: `wa_id` nullable, `phone_canonical` (generada con `public.normalize_phone`, índice ÚNICO), `classification`, `classification_source`, `classified_at`, `last_purchase_at`. La columna heredada `contacts.company` (texto) se conserva pero ya no se edita: la relación real son los vínculos.
- `companies` (nombre comercial único sin distinguir mayúsculas, razón social, RFC, teléfono fijo, condiciones de pago y crédito, clasificación, `last_purchase_at`) y `company_tags` (las mismas etiquetas que los contactos).
- `person_company_links` (persona ↔ empresa: `is_active`, `can_order`, `order_limit`, `requires_authorization`), `contact_roles` (catálogo; 6 del sistema que no se pueden borrar) y `link_roles`.
- `orders` (folio `order_number` por identidad, cuenta = `contact_id` XOR `company_id`, `requested_by`, estados `pendiente_autorizacion | confirmado | entregado | cancelado`, `collect_on_delivery`, `authorization_reasons`), `order_items` (`line_total` generado), `payments` e `invoices` (registro administrativo; archivo opcional en el bucket privado `documentos`, ruta `facturas/{uid}/…`, 20 MB, pdf/jpg/png/xml).
- `classification_history` (solo lectura, la llenan triggers), `classification_suggestions` (como máximo una pendiente por contacto) y `app_settings` (`inactivity_days`, `intent_keywords`; solo admin escribe).
- Vistas (`security_invoker`): `account_balances` (pedidos confirmados o entregados − pagos, por cuenta) y `contact_directory` (personas y empresas juntas con `is_inactive`, `last_interaction`, nombres relacionados, etiquetas y funciones).
- Funciones con `search_path` fijo. Las SECURITY DEFINER viven en `private`, validan `auth.uid()` y el rol dentro de la función y no las ejecuta `anon`; en `public` solo hay envoltorios INVOKER: `create_order`, `approve_order`, `set_classification`, `resolve_suggestion`, `search_directory`, `normalize_phone` y `upsert_whatsapp_contact` (solo `service_role`).
- Las reglas se aplican en la base con triggers (`private.protect_company_credit`, `protect_link_permissions`, `protect_order`, `stamp_classification`, `log_classification`, `apply_order_purchase`, `detect_prospect_signal`, `check_account_order`). La interfaz solo oculta o deshabilita.

## Reglas de negocio de contactos
1. **Tipos.** Hay personas (`contacts`) y empresas (`companies`). Una persona puede estar vinculada a varias empresas con una o más funciones (Propietario, Comprador autorizado, Responsable de pagos…). Desvincular = desactivar el vínculo (se conserva el historial); borrar un vínculo es solo de admin.
2. **Clasificación** (`unclassified | prospect | customer | supplier`: «Sin clasificar», «Prospecto», «Cliente», «Proveedor»), por persona y por empresa. Cada cambio queda en `classification_history` con origen (`default | suggestion | manual | order`), usuario y motivo. La etiqueta «Cliente» que ya existía es independiente y no se toca.
3. **Prospecto: solo sugerencia.** Si un contacto «Sin clasificar» manda un texto con una palabra de `intent_keywords` (sin acentos ni mayúsculas, al inicio de palabra: «obra» detecta «obras» pero no «maniobra»), se crea una sugerencia pendiente y el chat muestra «Posible prospecto: …». El agente la acepta (pasa a Prospecto con origen `suggestion`) o la descarta. Nunca se clasifica solo, y la detección nunca bloquea el guardado del mensaje.
4. **Cliente: por pedido.** Al confirmarse (o entregarse) un pedido, la CUENTA que lo paga pasa de Sin clasificar o Prospecto a Cliente (origen `order`, motivo «Pedido #N») y se actualiza su `last_purchase_at`. En los pedidos de empresa cambia la empresa, no el solicitante. Un Proveedor que compra sigue siendo Proveedor (solo se actualiza la fecha). Un pedido pendiente de autorización no promueve ni suma al saldo hasta que se aprueba.
5. **Inactivo.** Un Cliente sin compras en `inactivity_days` días (90 por defecto, editable en Configuración → Contactos y ventas) se muestra «Inactivo». Si nunca compró (lo marcaron a mano), cuenta desde `classified_at`.
6. **Teléfonos únicos entre personas** (normalizados: 10 dígitos, 52 + 10 y 521 + 10 son el mismo número). Un duplicado muestra un aviso en español con enlace al contacto existente (`notifyDuplicatePhone`). El fijo compartido va en la empresa.
7. **Crédito y condiciones** (`contado | credito`, días y límite): solo un admin los cambia, y queda registrado quién y cuándo autorizó. Una empresa creada por un agente siempre nace de contado.
8. **Permisos de pedido** del vínculo (puede pedir, límite por pedido, requiere autorización): solo admin.
9. **Pedidos** (`rpc("create_order")`; la base calcula el total). Quedan **pendientes de autorización** si: (a) el solicitante no está vinculado, el vínculo está inactivo o no puede pedir; (b) el total supera su límite por pedido; (c) saldo + pedido supera el límite de crédito de la empresa; (d) el vínculo exige autorización siempre. Solo un admin aprueba (`rpc("approve_order")`, con motivo obligatorio). Cancelado es definitivo y nada vuelve a pendiente.
10. **Cobrar al entregar**: todo pedido personal y todo pedido de una empresa sin crédito autorizado.
11. **Saldo** = pedidos confirmados o entregados − pagos (`account_balances`). Cualquiera registra pagos y facturas; corregir o borrar un pago y cambiar el estado de una factura es solo de admin. Un pago o una factura ligados a un pedido deben ser de la misma cuenta.
12. **Pedidos personales y como empleado**: la ficha de la persona separa sus compras propias (`orders.contact_id`) de los pedidos que hizo a nombre de empresas (`requested_by` con `company_id`).
13. Fuera de alcance: inventario, catálogo de productos, CFDI, cuentas por pagar, cobranza automática por WhatsApp y documentos de cotización.

## Estructura de la app
- `src/app/(crm)/`: rutas protegidas con layout común (navegación lateral + proveedores). Páginas: `/` (Bandeja, `?c=<id>` abre una conversación), `/contactos`, `/contactos?tab=todos|sin-clasificar|prospectos|clientes|proveedores|empresas`, `/contactos/persona/[id]` y `/contactos/empresa/[id]` (fichas completas; con Cache Components los `params` se leen dentro de `<Suspense>`), `/estadisticas` (provisional, «Próximamente») y `/configuracion?tab=perfil|usuarios|notificaciones|apariencia|etiquetas|respuestas-rapidas|funciones|contactos-ventas`. `/ajustes`, `/etiquetas` y `/respuestas-rapidas` redirigen ahí (`next.config.ts`).
- `src/components/crm/`: `CrmProvider` (usuario actual, perfiles y etiquetas: `useCrm()`), `NotificationsProvider` (sonido MP3 con desbloqueo tras la primera interacción y máximo uno por segundo, contador en el título, notificaciones del navegador y estado REAL de Realtime: `useNotifications()`), `AppShell` (barra lateral colapsable ≥ 768 px y barra inferior < 768 px: `useShell()`), avatar, chips, estados vacíos.
- Avatares: lógica única en `src/lib/crm/avatar.ts` (`avatarFor`): emoji inicial completo, icono «empresa» si hay empresa, iniciales o icono «persona». Recorrer nombres por grafemas (`Intl.Segmenter`), nunca con `name[0]`.
- `src/components/inbox/`: bandeja (`inbox.tsx` orquesta el estado, Realtime y el layout adaptable), lista con filtros y scroll infinito, chat (botón «notas» alterna con las notas internas), composer con ventana de 24 h, chips y menú «/» de respuestas rápidas, emojis y adjuntos (selector, arrastrar y soltar, pegar). Multimedia en `src/components/inbox/media/` (URL firmada perezosa con `useMediaUrl`, visor, reproductor de audio, documentos solo descargables).
- `src/components/contacts/`: ficha editable (`ContactDetails`, guardado automático al salir del campo), clasificación con historial (`ClassificationControl`), vínculos persona–empresa (`CompanyLinks`), selectores de empresa/persona/etiquetas, directorio (`ContactsView`, usa `search_directory`), fichas completas (`PersonPage`, `CompanyPage`) y alta (`NewEntryDialog`).
- `src/components/orders/`: diálogo de pedido (`OrderDialog`, desde la ficha, la empresa o el menú ⋮ del chat), lista de pedidos con autorización, pagos y facturas, `useAccountData` (pedidos, pagos, facturas y saldo de una cuenta).
- Un componente con `usePathname()` en el layout debe ir dentro de `<Suspense>`: en rutas con `[id]` el pathname es dato de petición (por eso `TitleCounter` está aparte en `NotificationsProvider`).
- `src/lib/crm/`: tipos, consultas (`contacts.ts`, `companies.ts`, `orders.ts`, `classification.ts`), filtros, plantillas (`{{nombre}}`, `{{primer_nombre}}`, `{{telefono}}`, `{{empresa}}`).
- `src/app/api/admin/users`: listar, crear y eliminar usuarios (verifica sesión y rol con `requireAdmin()` antes de usar la service role).

## Diseño
- Marca: naranja `#EC5E2A` (token `--marca`). Con texto blanco usar `--marca-fuerte` (AA); texto naranja: `--marca-texto`; fondos de selección: `--marca-suave`. Todos los pares de tokens están verificados con contraste AA (los valores están comentados en `globals.css`).
- Todos los colores son tokens en `src/app/globals.css` con nombres en español (`superficie`, `borde`, `texto(-suave)`, `exito`, `advertencia`, `error`, `lateral-*`, `burbuja-*`, `nota-*`, `avatar-1..8`) y alias de shadcn (`primary` = `marca-fuerte`, etc.). No usar colores sueltos de Tailwind. Única excepción: el color de cada etiqueta (`tags.color`), mezclado con `--etiqueta-texto-base` para asegurar contraste.
- La barra lateral SIGUE EL TEMA (tokens `--lateral*` en `:root` y `.dark`: fondo, borde, texto, texto-fuerte, texto-suave, hover, activo, activo-texto, activo-icono, acento, tarjeta, tarjeta-borde, pie; contrastes AA comentados). Área de trabajo clara por defecto, con oscuro y sistema.
- Barra lateral colapsable (`src/components/crm/app-nav.tsx`):
  - ≥ 1024 px empuja el contenido; abierta (240 px) o recogida (72 px) según la cookie `sidebar_collapsed` (`src/lib/sidebar.ts`), que el layout `(crm)` lee en el servidor (dentro de `<Suspense>`, obligatorio con cacheComponents) para pintar el estado correcto sin parpadeo. Sin cookie: abierta.
  - 768–1023 px empieza recogida y se abre SUPERPUESTA con fondo atenuado; se cierra al elegir una opción, al pulsar fuera o con Escape (no se guarda).
  - < 768 px: barra inferior, sin barra lateral.
  - El aspecto de cada estado lo resuelve el CSS con las variantes `sidebar-expanded:` / `sidebar-collapsed:` (definidas en `globals.css` sobre `data-sidebar-collapsed` / `data-sidebar-overlay` del contenedor `.sidebar-root`). El JavaScript solo guarda el estado, ARIA y tooltips. Animación de ancho de 225 ms (`--lateral-duracion`) y textos con fundido y recorte; sin animación con `prefers-reduced-motion`.
  - Estructura sin desplazamientos: TODAS las filas (logo, opciones, botón, planta, perfil) tienen una columna izquierda de 72 px (= ancho recogido) con el icono centrado y el texto a la derecha, que aparece con fundido. Las capas de hover/foco y la tarjeta de la planta son absolutas (inset-x-2) y no mueven nada. Medido: la X de cada icono es idéntica abierta, recogida y a mitad de la animación.
  - El logo: el cubo (`logo-icono.svg`) queda fijo en la columna; al abrir aparece a su derecha SOLO el texto del logo completo, recortado y escalado con la geometría medida en `LOGO_GEOMETRY` (`src/lib/brand.ts`). Si cambian los archivos de logo, hay que volver a medir.
  - El botón ocultar/mostrar está en el bloque inferior, encima de la planta (orden de abajo arriba: perfil, planta, botón).
  - Opción activa: UNA píldora (`bg-lateral-activo` + acento) que se desliza con `translateY(índice × --lateral-fila-paso)` (250 ms) y el icono activo escalado a 1.08 (en Tailwind v4 `scale-*` usa la propiedad CSS `scale`: transicionar `scale`, no `transform`). La píldora se mueve al hacer clic (estado `pending`, derivado y descartado al cambiar la ruta); `aria-current` sigue a la ruta real.
- Medidas: `--lateral-ancho`, `--lateral-ancho-mini`, `--lista-ancho`, `--ficha-ancho`, `--barra-inferior-alto` (se usan como `w-(--lista-ancho)`). Breakpoints: < 1024 px una columna con barra inferior; ≥ 1024 lista + chat; ≥ 1536 además la ficha como columna (antes, panel deslizante).
- Iconos (incluye `menu-ocultar` / `menu-mostrar` para el botón de la barra): `<Icon name="…" />` (`src/components/ui/icon.tsx`) dibuja inline los SVG de `public/icons` con `currentColor`; regenerar con `npm run iconos`. Sin equivalente, lucide-react con el mismo tamaño y grosor. Botones de solo icono: `IconButton` (aria-label + tooltip).
- Logos (`src/lib/brand.ts`, `src/components/crm/brand-logo.tsx`): sus nombres están AL REVÉS de lo que sugieren (verificado decodificando los PNG y con capturas): `logo-lg-blocks-oscuro.svg` tiene el texto BLANCO (fondos oscuros) y `logo-lg-blocks-claro.svg` el texto OSCURO (fondos claros); en el código se llaman `logoFondoOscuro` / `logoFondoClaro`. Son PNG en base64 dentro de SVG: `<img>` sin optimizar. Para alternar por tema NO se usa estado de JavaScript: `ThemedWordmark` renderiza las dos con `dark:hidden` / `hidden dark:block` y `loading="lazy"` (la oculta no se descarga). El subtítulo del logo es gris dentro del PNG: en fondo claro queda por debajo de AA y a tamaños pequeños es ilegible; corregirlo requiere un logo nuevo, no filtros.
- Los archivos de `public/brand`, `public/icons` y `public/sounds` son originales: no modificarlos.
- Toasts con `sonner`, `EmptyState` (vacío o `tone="error"` con «Reintentar»).
- Carga: `Skeleton` (`src/components/ui/skeleton.tsx`) usa la clase `.esqueleto` (tokens `--esqueleto`/`--esqueleto-brillo` y brillo animado). Pantallas de carga por sección en `src/components/crm/section-skeletons.tsx` (mismas clases y medidas que el contenido real; los encabezados usan el `PageHeader` real), usadas por los `loading.tsx` y por los fallbacks de Suspense de Bandeja y Configuración. `.esqueleto-entrada` las hace aparecer solo tras 150 ms (sin JavaScript): en cargas rápidas no se ven. La Bandeja vive en el grupo `(crm)/(bandeja)/` para tener su propio `loading.tsx`.
- Transiciones: `(crm)/template.tsx` aplica `.entrada-seccion` (fundido + 8 px, 200 ms) solo al cambiar de sección; no se vuelve a montar con `?c=`/`?tab=` ni al elegir conversación (verificado: mismo elemento y la búsqueda se conserva). `.entrada-fila` (escalonada, 30 ms, primeras 8 filas, solo en la primera carga) se usa en Contactos; NUNCA en la lista de conversaciones ni en los mensajes. Animar solo `transform`/`opacity` (excepto el ancho de la barra). Con `prefers-reduced-motion` no hay brillo, deslizamientos, escalado ni escalonado.

## Secretos y clientes de Supabase
- Nunca poner secretos en el código ni en logs (ni tokens, ni payloads completos, ni correos o contraseñas de usuarios). Todo va en `.env.local`, que no se muestra ni se sube a git.
- Variables: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `src/lib/supabase/admin.ts` usa `SUPABASE_SERVICE_ROLE_KEY`: solo del lado del servidor (webhook, descarga de medios entrantes, limpieza de subidas descartadas y `/api/admin/*` después de `requireAdmin()`). Nunca importarlo desde componentes cliente.
- `src/lib/supabase/server.ts`: cliente con la sesión del usuario (route handlers / server components).
- `src/lib/supabase/client.ts`: cliente del navegador (respeta RLS). Todas las acciones del usuario van por aquí o por rutas que verifican sesión y rol.
