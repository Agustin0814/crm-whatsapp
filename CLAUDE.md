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
Tablas: `profiles`, `contacts`, `conversations`, `messages`, `tags`, `contact_tags`, `notes`, `quick_replies`, las de contactos y ventas (ver «Contactos, empresas y ventas») y las de agentes (ver «Agentes de IA»).
- Los tipos están en `src/lib/supabase/database.types.ts` (regenerarlos con `generate_typescript_types` si cambia el esquema). Revisar el esquema real antes de escribir queries.
- Cambios de esquema solo con migraciones (`apply_migration`) y después `get_advisors` (seguridad y rendimiento).
- El trigger `messages_touch_conversation` (AFTER INSERT en `messages`) actualiza `last_message_at`, `last_message_preview`, `last_inbound_at` y `unread_count` de `conversations`. **No repetir esa lógica en el código.**
- `messages.status`: `received | sending | sent | delivered | read | failed`. `messages.direction`: `inbound | outbound`.
- `conversations.status`: `open | pending | resolved | archived` (etiquetas en `src/lib/crm/types.ts`).
- Una conversación por contacto (`conversations.contact_id` es único).
- `contacts.updated_at` se actualiza solo (trigger `contacts_set_updated_at`).
- Realtime publica `messages`, `conversations`, `notes` y `agent_suggestions`.
- El trigger también guarda `conversations.last_message_type` (icono de la vista previa) y usa etiquetas en español para mensajes sin texto («Imagen», «Audio», «Video», «Documento», «Sticker», «Mensaje»); si hay leyenda, la vista previa es la leyenda.

### Roles y RLS (migración `crm_roles_y_politicas`)
- `profiles.role`: `superadmin | admin | agent` («Proveedor», «Administrador», «Agente»). Helpers `private.is_admin()` (verdadero para admin Y superadmin) y `private.is_superadmin()` (esquema `private`, no expuesto por la API). En el código: `isAdminRole()` (`src/lib/crm/types.ts`), `useCrm().isAdmin` / `isSuperadmin` y `requireAdmin()`.
- Superadmin = el proveedor: solo él da o quita ese rol (trigger `profiles_protect_role`), solo otro superadmin lo elimina y es el único que ve y edita la capa bloqueada de los agentes. Se asigna por SQL.
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

## Principio rector: todo ocurre en el chat
- Este CRM es esencialmente mensajería. TODO ocurre dentro del chat, sin navegar a otras rutas ni pantallas (no hay páginas de detalle: la ficha es un panel).
- Cada acción cuesta el mínimo de pasos: nada de diálogos con fechas, formularios largos ni botones encadenados.
- Las notas son UNA sola cosa: las notas internas del chat (autor, fecha y hora automáticos). Las «Notas generales» de la ficha son solo un texto editable.
- Las compras son UN contador.
- Agentes de IA: el primero (Asistente de respuestas) ya existe (ver «Agentes de IA»); vendrán otros (asistente que toma notas). Por eso la lógica vive en funciones de servidor reutilizables y NO se duplica en componentes: `add_internal_note`, `update_purchase_count`, `set_classification` y el motor de `src/lib/agents/`.

## Principio rector: esto es un CRM, no un ERP
- NO se llevan pedidos, productos, montos, gastos, pagos, facturas, saldos, crédito ni inventario.
- De cada cliente solo interesa CUÁNTAS compras ha hecho (un contador) y, si el usuario quiere, una nota con fecha de qué compró.
- **Antes de agregar cualquier función nueva de ventas, comprobar que respeta este principio.** Si pide montos, productos o estados de pedido, no va.

### Contactos, empresas y compras (migraciones `crm_contactos_empresas`, `crm_contador_compras` y anteriores)
- `contacts`: `wa_id` nullable, `phone_canonical` (generada con `public.normalize_phone`, índice ÚNICO), `classification`, `classification_source`, `classified_at`, `purchase_count`, `last_purchase_at`. La columna heredada `contacts.company` (texto) se conserva pero ya no se edita: la relación real son los vínculos.
- `companies` (nombre comercial único sin distinguir mayúsculas, razón social, RFC, teléfono, correo, dirección, notas, clasificación, `purchase_count`, `last_purchase_at`) y `company_tags` (las mismas etiquetas que los contactos).
- `person_company_links` (persona ↔ empresa, `is_active`), `contact_roles` (catálogo de funciones; 6 del sistema que no se pueden borrar) y `link_roles`.
- `classification_history` (solo lectura, la llenan triggers), `classification_suggestions` (como máximo una pendiente por contacto) y `app_settings` (`inactivity_days`, `intent_keywords`; solo admin escribe).
- Vista `contact_directory` (`security_invoker`): personas y empresas juntas con `is_inactive`, `last_interaction` (último mensaje o compra), nombres relacionados, etiquetas, funciones, `purchase_count` y `last_purchase_at`. `search_directory(...)` la filtra.
- `public.update_purchase_count(p_entity, p_id, p_action, p_value, p_undo)` (envoltorio INVOKER de una DEFINER en `private`, valida rol con `private.require_staff()`, bloquea la fila): `increment | decrement | set | undo`. Devuelve el estado y, en `increment`, lo necesario para deshacer (la base lo vuelve a validar). `public.add_internal_note(p_conversation_id, p_body)` crea notas internas. `contacts_summary()` da los conteos de las tarjetas de /contactos.
- `purchase_count` y `last_purchase_at` solo cambian dentro de `update_purchase_count` (trigger `protect_purchase_fields`, variable de sesión `app.purchase_internal`): un update directo se rechaza.
- **Pendiente de eliminar con confirmación del usuario** (ya no se usan en la interfaz ni en el directorio): `entity_notes` y sus funciones (`register_purchase`, `add_entity_note`, `adjust_purchase_count`, `delete_entity_note`, `last_purchase_from_history`), `orders`, `order_items`, `payments`, `invoices`, la vista `account_balances`, el bucket `documentos`, las funciones de pedidos/crédito y las columnas de crédito de `companies` y de permisos de compra de `person_company_links`. No construir nada sobre ellas.

## Reglas de negocio de contactos
1. **Tipos.** Hay personas (`contacts`) y empresas (`companies`). Una persona puede estar vinculada a varias empresas con una o más funciones (Propietario, Comprador autorizado, Responsable de pagos…). Desvincular = desactivar el vínculo (se conserva el historial); borrar un vínculo es solo de admin. Los vínculos NO tienen permisos de compra.
2. **Clasificación** (`unclassified | prospect | customer | supplier`: «Sin clasificar», «Prospecto», «Cliente», «Proveedor»), por persona y por empresa. Cada cambio queda en `classification_history` con origen (`default | suggestion | manual | purchase`; `order` solo en datos anteriores), usuario y motivo. La etiqueta «Cliente» que ya existía es independiente y no se toca.
3. **Prospecto: solo sugerencia.** Si un contacto «Sin clasificar» manda un texto con una palabra de `intent_keywords` (sin acentos ni mayúsculas, al inicio de palabra: «obra» detecta «obras» pero no «maniobra»), se crea una sugerencia pendiente y el chat muestra «Posible prospecto: …». El agente la acepta (pasa a Prospecto con origen `suggestion`) o la descarta. Nunca se clasifica solo, y la detección nunca bloquea el guardado del mensaje.
4. **Compras = contador en la ficha** (sección Datos, fila «Compras»: − número +; el número se puede escribir). Mismas reglas para personas y empresas, todo en `update_purchase_count`:
   - **+**: suma 1, `last_purchase_at` = ahora y, si estaba Sin clasificar o Prospecto, pasa a Cliente (origen `purchase`, queda en `classification_history`). Un Proveedor sigue siendo Proveedor. Sin diálogos; la interfaz cambia al instante (optimista, con retroceso si falla) y muestra «Compra registrada · Deshacer» ~6 s.
   - **Deshacer**: restaura contador, `last_purchase_at` y, si ese clic cambió la clasificación, la clasificación anterior con su origen y fecha. Solo si nadie cambió el contador desde entonces.
   - **−**: resta 1 (nunca bajo 0); en 0, `last_purchase_at` queda vacío. **Escribir el número**: lo fija sin crear registros. Ninguno de los dos revierte la clasificación.
5. **Qué compró** NO se registra en el contador: se escribe como nota interna del chat (fecha y hora automáticas).
6. **Fichas sin cambiar de página**: en /contactos, clic en una fila abre la MISMA ficha del chat (`ContactDetails`; `CompanyDetails` para empresas) en un panel lateral (`EntityPanel`, URL `?ficha=persona.<id>` o `empresa.<id>`). Con conversación hay «Abrir chat». Una persona sin conversación solo tiene notas generales. Las URLs viejas `/contactos/persona/:id` y `/contactos/empresa/:id` redirigen a /contactos.
7. **Inactivo.** Un Cliente sin compras en `inactivity_days` días (90 por defecto, editable en Configuración → Contactos y ventas) se muestra «Inactivo». Si nunca compró (lo marcaron a mano), cuenta desde `classified_at`.
8. **Teléfonos únicos entre personas** (normalizados: 10 dígitos, 52 + 10 y 521 + 10 son el mismo número). El fijo compartido va en la empresa. Ver «Teléfonos duplicados».
9. **/contactos**: tres tarjetas (Contactos = personas, Clientes = personas y empresas con «N inactivos», Empresas) que filtran la lista; buscador, pestañas por clasificación, filtros de etiquetas y funciones, «Nuevo» y la columna «Compras» (solo lectura, con la última compra). El título solo existe para lectores de pantalla (`sr-only`). La clasificación de la ficha es UNA línea: selector, origen y fecha en pequeño e historial tras un icono.
10. Fuera de alcance (principio rector): pedidos, productos, montos, pagos, facturas, saldos, crédito, inventario, CFDI, cobranza y cotizaciones.

## Teléfonos duplicados (migración `crm_telefonos_duplicados`)
- `companies.phone_canonical`: columna generada con `public.normalize_phone(phone)` (la misma de personas), índice NO único (un fijo de oficina puede repetirse). `companies.phone` se guarda tal como se capturó.
- `public.find_phone_matches(p_phone, p_exclude_kind, p_exclude_id)`: coincidencias entre personas (`phone_canonical` o `wa_id`) y empresas (`phone_canonical`) con tipo, id, nombre, clasificación, si la persona tiene conversación y si ya existe un vínculo activo con el registro excluido. «6444075142», «+52 644 407 5142», «52 644 407 5142» y «5216444075142» son el mismo número; con menos de 10 dígitos no busca.
- Guardados verificados en la base (INVOKER, `search_path` fijo, solo `authenticated`, validan el rol con `private.require_staff()`): `create_person`, `create_company`, `update_phone`. Devuelven jsonb `created | updated | blocked | needs_confirmation | name_taken`. El cliente manda los ids que el usuario vio (`p_acknowledged`); el servidor vuelve a buscar y, si aparece una coincidencia no confirmada, NO guarda y responde `needs_confirmation`.
- **Nunca** cambiar `contacts.phone` ni `companies.phone` con un update directo desde la interfaz: `updateContact` y `updateCompany` descartan `phone`; se usa `PhoneField` (edición) o `NewEntryDialog` (alta), que llaman a esas funciones.
- Reglas:
  1. Persona con el teléfono de otra persona: BLOQUEO («Este número ya está registrado como X», con «Abrir contacto» y «Editar ese contacto» → panel en `/contactos?ficha=persona.<id>&editar=1`). Lo garantiza el índice único `contacts_phone_canonical_key`; si dos altas chocan a la vez, la función traduce el `unique_violation` a `blocked`.
  2. Empresa con el teléfono de una persona: advertencia con «Vincular a esta empresa» (funciones, sugerida «Contacto principal»), «Crear de todos modos» o «Cancelar». Al crear, la empresa y el vínculo se hacen en UNA transacción (`create_company` con `p_link_contact_id`).
  3. Persona con el teléfono de una empresa: «Este número es de la empresa X» con «Crear y vincular a esa empresa», «Crear de todos modos» o «Cancelar».
  4. Empresa con el teléfono de otra empresa: «Posible duplicado» con «Abrir esa empresa», «Crear de todos modos» o «Cancelar».
  5. Lo mismo al editar un teléfono (el registro se excluye a sí mismo; las coincidencias ya vinculadas no piden confirmación).
  6. Vincular (`public.link_contact_to_company`) nunca cambia clasificaciones (los vínculos no tienen permisos de compra).
- Aviso del chat (`CompanyMatchBanner`): `public.company_phone_matches(p_contact_id)` devuelve empresas con el mismo teléfono que la persona, sin vínculo activo y no descartadas. Se calcula al vuelo (no hay trigger en el webhook ni se vincula solo). Los descartes viven en `phone_match_dismissals` (persona, empresa, quién y cuándo; insertar solo con `dismissed_by = auth.uid()`, borrar solo admin). No se reutilizó `classification_suggestions` porque es de clasificación, no tiene empresa y solo admite una pendiente por contacto.
- Presentación: todos los teléfonos se muestran con `formatPhone` («+52 644 407 5142», también 10 dígitos y empresas). Solo es visual.

## Agentes de IA (migración `crm_agentes_ia`)
Principio: el agente es MENSAJERÍA. Solo responde en el chat; ninguna herramienta toca contactos, clasificaciones, notas, compras ni nada de ERP.

### Dos capas de configuración
- **Capa editable** (`agents.config` jsonb, admin): información del negocio, tono, horario (`always | after_hours | custom`, America/Hermosillo), retraso (0–10 min), alcance (clasificaciones, por defecto Sin clasificar y Prospecto; etiquetas excluidas), límites (respuestas seguidas, tope diario), escalamiento (temas, mensaje de traspaso, a quién asignar), instrucciones adicionales (máx. 1000) y alertas. Forma y recortes en `src/lib/agents/config.ts` (`parseAgentConfig`, compartido cliente/servidor, sin secretos).
  - Se guarda SOLO con `public.update_agent_settings(p_key, p_enabled, p_mode, p_config)` (null = no cambiar); la base recorta a los techos. `agents` no tiene UPDATE directo. `public.agent_limits(p_key)` da los rangos permitidos sin exponer el prompt.
- **Capa bloqueada** (`agent_locked_config`, RLS solo superadmin): identidad, reglas de seguridad, modelo, temperatura (null = la del modelo), `max_output_tokens`, `reasoning_effort` (low), herramientas permitidas, techos (`max_consecutive_ceiling`, `daily_cap_ceiling`, `monthly_token_cap`), precios por millón para el costo estimado y `kill_switch`. El motor la lee con service role.
- Respuestas rápidas: `quick_replies.when_to_use` y `agent_permission` (`automatic | approval | human_only`, por defecto human_only). `human_only` nunca la ve el modelo; `approval` siempre queda como sugerencia, aun en automático.

### Motor (`src/lib/agents/`; solo servidor salvo `config.ts`, `guards.ts` y `client.ts`)
- `provider.ts`: interfaz agnóstica `generateReply({system, messages, tools, limits})` → herramienta elegida + tokens REALES. Implementación `providers/openai.ts` (Responses API con fetch, `tool_choice: required`, `store: false`, `OPENAI_API_KEY`). Otro proveedor = otra implementación.
- `prompt.ts`: orden fijo (a) identidad + reglas bloqueadas (+ guardia base anti prompt injection), (b) negocio, (c) tono, (d) respuestas rápidas con «cuándo usarla», (e) instrucciones del cliente SIEMPRE debajo, (f) historial (20 mensajes; el texto del cliente es dato no confiable). Herramientas: `enviar_respuesta_rapida(shortcut)`, `responder_texto_corto(texto)`, `transferir_a_humano(motivo)`.
- `guards.ts` (puro): horario, temas de escalamiento (sin acentos, al inicio de palabra), alcance y costo.
- `engine.ts`: `scheduleAgentsForInbound` (lo llama el webhook tras guardar un entrante NUEVO) y `processDueRuns`. Guardas en orden; cada una registra outcome y motivo en `agent_usage_log`: habilitado → kill switch → pausado → ventana 24 h → contacto con WhatsApp → nadie respondió ya → (automático) nadie abrió el chat (`conversations.human_seen_at`, lo pone `markRead`) → alcance → horario → respuestas seguidas (al llegar al límite, traspaso) → tope diario → tope mensual de tokens (alerta al superadmin) → tema de escalamiento (traspaso sin gastar tokens) → modelo.
- `send.ts`: `sendAgentText` reutiliza `sendTextMessage` (con `toSendableNumber`) y la ventana de 24 h; guarda con `sent_by_agent = true` y `agent_id` usando el cliente admin.
- Modo sugerencia (por defecto): `agent_suggestions` (máx. una pendiente por conversación, Realtime) → banner «Sugerencia del asistente» (Enviar / Editar / Descartar) que llama a `POST /api/agents/suggestions/[id]`. El mensaje enviado lleva «Asistente» y el `sender_id` de quien lo aprobó. Modo automático: envía directo.
- Traspaso: envía (o sugiere) el mensaje de traspaso, pausa con motivo `handoff`/`limit_consecutive`, asigna si está configurado y crea una alerta.

### Pausa y respuestas seguidas (triggers; no repetir en código)
- `messages_agent_outbound`: saliente del agente → `agent_consecutive_count + 1`; saliente de una persona → pausa (`human_replied`), reinicia el contador y cancela la corrida y la sugerencia pendientes.
- `conversations_agent_update`: asignar a alguien → pausa (`assigned`); al pausar se cancela la corrida pendiente; un usuario nunca cambia `agent_consecutive_count` directamente.
- `public.set_agent_paused(p_conversation_id, p_paused)`: interruptor del encabezado del chat (`AgentPauseToggle`); reanudar reinicia el contador.
- `messages_protect_agent_fields`: solo el servidor (sin sesión) puede marcar `sent_by_agent`/`agent_id`.

### Programación con retraso
- `agent_scheduled_runs` (`pending | running | done | cancelled | skipped`): UNA pendiente por conversación (índice único parcial); un entrante nuevo la pospone. `schedule_agent_run` y `claim_agent_runs` (FOR UPDATE SKIP LOCKED; reintenta una vez las `running` de más de 5 min) son solo de service role.
- pg_cron cada minuto ejecuta `private.agent_cron_tick()`, que SOLO si hay corridas vencidas llama con pg_net a `POST /api/agents/run` con `Authorization: Bearer CRON_SECRET` (URL y secreto en Vault: `agents_runner_url`, `cron_secret`). La ruta está excluida del proxy y valida el secreto en tiempo constante (`src/lib/agents/cron-auth.ts`). Con retraso 0 se procesa en el `after()` del webhook.

### Uso y alertas
- `agent_usage_log` (outcome `sent | suggested | skipped | handoff | error | blocked_by_limit`, tokens reales, `est_cost_usd`), vista `agent_usage_monthly` (mes de Hermosillo) y `public.agent_usage_summary(p_key)` (hoy y mes contra el tope). Sin tablas duplicadas.
- `agent_alerts` (`handoff | daily_cap | token_cap | error`, `audience` admin o superadmin; una por día o mes de cada tipo).

### Interfaz
- `/agentes` (`src/components/agents/`): tarjeta (interruptor, modo, estado, uso de hoy, «Configurar»), resumen del mes, alertas y registro de actividad (solo admin). El panel lateral (`Sheet`) tiene la capa editable en secciones colapsables y, solo para superadmin, la pestaña «Capa bloqueada». Los agentes humanos ven el estado pero no editan.
- Icono del menú: provisional `Bot` de lucide (`NAV_ITEMS` acepta `IconName | LucideIcon`) hasta que exista `public/icons/icon-agentes.svg`.
- Preparado, sin construir: pestaña «Probador» (chat de prueba sin enviar a WhatsApp). Debe reutilizar `buildSystemPrompt` + `getModelProvider()` sin `sendAgentText`.

## Estructura de la app
- `src/app/(crm)/`: rutas protegidas con layout común (navegación lateral + proveedores). Páginas: `/` (Bandeja, `?c=<id>` abre una conversación), `/contactos`, `/contactos?tab=todos|sin-clasificar|prospectos|clientes|proveedores|empresas`, (la ficha se abre como panel con `?ficha=`), `/agentes` (asistentes de IA), `/estadisticas` (provisional, «Próximamente») y `/configuracion?tab=perfil|usuarios|notificaciones|apariencia|etiquetas|respuestas-rapidas|funciones|contactos-ventas`. `/ajustes`, `/etiquetas` y `/respuestas-rapidas` redirigen ahí (`next.config.ts`).
- `src/components/crm/`: `CrmProvider` (usuario actual, perfiles y etiquetas: `useCrm()`), `NotificationsProvider` (sonido MP3 con desbloqueo tras la primera interacción y máximo uno por segundo, contador en el título, notificaciones del navegador y estado REAL de Realtime: `useNotifications()`), `AppShell` (barra lateral colapsable ≥ 768 px y barra inferior < 768 px: `useShell()`), avatar, chips, estados vacíos.
- Avatares: lógica única en `src/lib/crm/avatar.ts` (`avatarFor`): emoji inicial completo, icono «empresa» si hay empresa, iniciales o icono «persona». Recorrer nombres por grafemas (`Intl.Segmenter`), nunca con `name[0]`.
- `src/components/inbox/`: bandeja (`inbox.tsx` orquesta el estado, Realtime y el layout adaptable), lista con filtros y scroll infinito, chat (botón «notas» alterna con las notas internas), composer con ventana de 24 h, chips y menú «/» de respuestas rápidas, emojis y adjuntos (selector, arrastrar y soltar, pegar). Multimedia en `src/components/inbox/media/` (URL firmada perezosa con `useMediaUrl`, visor, reproductor de audio, documentos solo descargables).
- `src/components/contacts/`: ficha editable (`ContactDetails`, guardado automático al salir del campo), clasificación con historial (`ClassificationControl`), vínculos persona–empresa (`CompanyLinks`), selectores de empresa/persona/etiquetas, directorio (`ContactsView`, usa `search_directory`), panel de fichas (`EntityPanel`, `CompanyDetails`) y alta (`NewEntryDialog`).
- Contador de compras: `src/components/contacts/purchase-counter.tsx`; panel de fichas: `entity-panel.tsx`; tarjetas de /contactos: `summary-cards.tsx`.
- Un componente con `usePathname()` en el layout debe ir dentro de `<Suspense>`: en rutas con `[id]` el pathname es dato de petición (por eso `TitleCounter` está aparte en `NotificationsProvider`).
- `src/lib/crm/`: tipos, consultas (`contacts.ts`, `companies.ts`, `purchases.ts`, `phones.ts`, `classification.ts`), filtros, plantillas (`{{nombre}}`, `{{primer_nombre}}`, `{{telefono}}`, `{{empresa}}`).
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
- Variables: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` y `CRON_SECRET` (las dos últimas solo en servidor, con `serverEnv`).
- `src/lib/supabase/admin.ts` usa `SUPABASE_SERVICE_ROLE_KEY`: solo del lado del servidor (webhook, descarga de medios entrantes, limpieza de subidas descartadas, motor de agentes, `/api/agents/*` y `/api/admin/*` después de `requireAdmin()`). Nunca importarlo desde componentes cliente.
- `src/lib/supabase/server.ts`: cliente con la sesión del usuario (route handlers / server components).
- `src/lib/supabase/client.ts`: cliente del navegador (respeta RLS). Todas las acciones del usuario van por aquí o por rutas que verifican sesión y rol.
