# Mapa de los agentes de IA

Estado al 26 de octubre de 2026. Hay dos agentes, cada uno con su tipo (`agents.kind`):

- **Asistente de respuestas** (`key = 'responder'`, `kind = 'responder'`): responde en el chat de WhatsApp.
- **Asistente de notas** (`key = 'notes'`, `kind = 'notes'`): **nunca habla con el cliente**. Escribe notas internas y mantiene el resumen del cliente. Ver la sección 8.

Principio: los agentes son **mensajería**. Ninguno toca contactos, clasificaciones, compras ni nada de ERP.

---

## 1. Rutas de páginas

| Ruta | Qué muestra | Quién la ve |
|---|---|---|
| `/agentes` | Encabezado «Agentes» con el botón **Registro de actividad** (abre un panel lateral). Debajo: 3 tarjetas de uso del mes que suman todos los agentes (respuestas, tokens con su barra y tope, costo estimado), luego los avisos sin leer y al final la lista de agentes (tabla en pantallas anchas, tarjetas en el móvil) con Estado, Modo y **Configurar**. | Todos con sesión. Tarjetas, avisos y registro: solo admin y superadmin. |
| `/agentes` → «Configurar» (panel lateral) | Pestaña **Configuración**: el panel del cliente. Pestaña **Proveedor**: la capa del proveedor, solo superadmin. **Probador**: deshabilitado («Próximamente»). | Lo ve cualquiera; solo admin y superadmin pueden editar. La pestaña Proveedor solo existe para superadmin. |
| `/` (Bandeja) | En el chat: interruptor de pausa del asistente en el encabezado, banner «Sugerencia del asistente» sobre el composer y la etiqueta con el nombre del asistente en sus mensajes. En «notas»: tarjeta fija «Resumen del cliente» y las notas del Asistente de notas (icono de bot y su nombre). | Todos con sesión. |
| `/configuracion?tab=respuestas-rapidas` | Editor de respuestas rápidas. «Cuándo usarla» y «Permiso del agente» solo aparecen para superadmin. | Editan admin y superadmin. |

## 2. Rutas de API

| Ruta | Método | Quién puede llamarla | Qué hace |
|---|---|---|---|
| `/api/agents/run` | POST | Solo con `Authorization: Bearer CRON_SECRET`, comparado en tiempo constante. Está excluida del `proxy` (no usa sesión). | Toma las corridas vencidas con `claim_agent_runs` y las ejecuta con `processDueRuns`. Es idempotente y no responde dos veces. `maxDuration` de 60 s. |
| `/api/agents/suggestions/[id]` | POST `{action: "send" \| "discard", texts?}` | Sesión de un usuario con perfil (cualquier rol). | `send`: reserva la sugerencia (la pasa de `pending` a `sent`/`edited`) y envía sus partes en orden con `sendAgentText`; si no salió ninguna, la devuelve a `pending`. `discard`: la marca descartada. |
| `/api/agents/preview` | POST `{messages, history?, contactName?, agentKey?}` | Solo **superadmin** con sesión. | Probador sin envío: arma el prompt real y devuelve lo que respondería el agente (mensajes, preguntas detectadas, reintento, tokens, costo). No envía a WhatsApp ni escribe en la base. |
| `/api/whatsapp/webhook` | POST | Firma `X-Hub-Signature-256` de Meta. | Guarda el mensaje entrante y, dentro del `after()`, programa la respuesta del agente (y la procesa en ese momento si la espera es 0). |
| *(Supabase RPC)* `update_agent_settings`, `agent_limits`, `set_agent_paused`, `agent_usage_summary` | RPC | Sesión de personal (`require_staff`). `update_agent_settings` exige además admin o superadmin. | Guardar la capa del cliente, leer los rangos, pausar o reanudar un chat y ver el uso de hoy (este último ya no lo usa la interfaz). |
| *(Supabase RPC)* `schedule_agent_run`, `claim_agent_runs` | RPC | Solo `service_role`. | Programar o posponer una corrida y tomar las vencidas. |
| *(Supabase RPC)* `schedule_notes_run`, `save_notes_pass` | RPC | Solo `service_role`. | Programar la pasada del Asistente de notas (silencio, traspaso o lote) y guardar notas + resumen + marca en una transacción. |
| *(Supabase RPC)* `update_contact_summary` | RPC | Personal (`require_staff`). | Una persona corrige el texto del resumen del cliente. |
| *(Supabase RPC)* `enqueue_notes_backfill`, `notes_backfill_status`, `cancel_notes_backfill` | RPC | Solo **superadmin**. | «Procesar chats existentes»: poner en cola, ver avance y detener. |
| *(Tabla)* `agent_locked_config` | SELECT / UPDATE por RLS | **Solo superadmin**. No tiene políticas de INSERT ni DELETE. Verificado con sesiones simuladas de admin y de un usuario sin rol: 0 filas. | La capa del proveedor. No tiene ruta de API propia. |

## 3. Archivos

### Motor (`src/lib/agents/`)

| Archivo | Qué hace | Se conecta con |
|---|---|---|
| `config.ts` | Tipos y recortes de la **capa del cliente** (`AgentConfig`, `AgentLimits`, `parseAgentConfig`), presets de espera, etiquetas y la regla efectiva `isQuickReplyUsable`. Sin secretos; lo usan el cliente y el servidor. | `engine.ts`, `client.ts`, el panel, `use-agent-names.ts`, el editor de respuestas rápidas |
| `provider.ts` | Interfaz agnóstica `generateReply({system, messages, tools, limits})` y el error `ModelProviderError`. | `providers/openai.ts`, `engine.ts` |
| `providers/openai.ts` | Implementación con la Responses API de OpenAI (fetch, `tool_choice: required`, `store: false`, `OPENAI_API_KEY`). Devuelve la herramienta elegida y los tokens reales. | `provider.ts`, `@/lib/env` |
| `prompt.ts` | Arma el prompt en orden fijo: identidad, nombre y reglas → escalamiento → negocio → tono → respuestas rápidas → historial. También define las 3 herramientas. | `engine.ts` |
| `guards.ts` | Reglas puras: horario (Hermosillo), temas de escalamiento, alcance y costo estimado. | `engine.ts` |
| `engine.ts` | `scheduleAgentsForInbound` (lo llama el webhook; programa cada agente según su tipo) y `processDueRuns` (cada corrida va al motor de su tipo: respuestas en orden, notas de 4 en 4) / `executeRun`: aplica las guardas, llama al modelo, entrega la respuesta, sugiere o transfiere, y registra el uso y los avisos. Al transferir, programa la pasada de notas. | Webhook, `/api/agents/run`, `send.ts`, `prompt.ts`, `guards.ts`, `provider.ts`, `notes-engine.ts` |
| `send.ts` | `sendAgentText`: ventana de 24 h, `sendTextMessage` (con `toSendableNumber`) y guardado con `sent_by_agent = true` usando el cliente admin. | `engine.ts`, `/api/agents/suggestions/[id]`, `@/lib/whatsapp/send` |
| `cron-auth.ts` | `isValidCronRequest`: compara el Bearer con `CRON_SECRET` en tiempo constante. | `/api/agents/run` |
| `client.ts` | Consultas del navegador (sesión, RLS): agentes, rangos, uso del mes, registro, avisos, guardar la capa del cliente, la capa del proveedor, sugerencias, pausa, resumen del cliente y «Procesar chats existentes». | Componentes de `/agentes` y del chat |
| `shared.ts` | Utilidades de servidor de todos los motores: `periodStarts`, `alertOnce`, `describe`. | `engine.ts`, `notes-engine.ts` |
| `notes-config.ts` | Capa del cliente del Asistente de notas (`parseNotesConfig`, casillas «Qué anota», presets de silencio). Cliente y servidor. | Panel, `notes-engine.ts` |
| `notes-plan.ts` | Lógica pura: función `registrar_notas`, `validateNotesPlan`, `redactSensitive`, duplicados, `isTrivialText`, contadores. | `notes-engine.ts`, `notes-prompt.ts`, tarjeta del resumen |
| `notes-prompt.ts` | Prompt del Asistente de notas: reglas fijas `NOTES_BASE_RULES`, «Qué anotar» y el turno con resumen, contadores, notas previas y mensajes nuevos. | `notes-engine.ts` |
| `notes-engine.ts` | `scheduleNotesForInbound`, `scheduleNotesForHandoff`, `executeNotesRun` y `getContactSummary` (preparada para el Asistente de respuestas, aún sin conectar). | `engine.ts` |

### Rutas (`src/app/`)

| Archivo | Qué hace | Se conecta con |
|---|---|---|
| `(crm)/agentes/page.tsx` | Página `/agentes`; renderiza `AgentsView`. | `components/agents/agents-view.tsx` |
| `(crm)/agentes/loading.tsx` | Esqueleto de carga (`AgentsSkeleton`): tarjetas arriba y tabla o tarjeta debajo. | `components/crm/section-skeletons.tsx` |
| `api/agents/run/route.ts` | Procesador que llama el cron. | `cron-auth.ts`, `engine.ts` |
| `api/agents/suggestions/[id]/route.ts` | Envía o descarta una sugerencia. | `send.ts`, Supabase (admin y sesión) |
| `api/whatsapp/webhook/route.ts` | Recibe de Meta y procesa en `after()`. | `lib/whatsapp/process-webhook.ts` |

### Componentes de `/agentes` (`src/components/agents/`)

| Archivo | Qué hace | Se conecta con |
|---|---|---|
| `agents-view.tsx` | Página completa: tarjetas de uso de todos los agentes, avisos, lista de agentes (`AgentIdentity`, `StatusControl`, `ModeControl`, `ConfigureButton`) y los dos paneles laterales (Configurar y Registro). | `client.ts`, `agent-config-form.tsx`, `locked-config-form.tsx`, `activity-log.tsx` |
| `agent-config-form.tsx` | **Panel del cliente**: Nombre, Tono, Cuándo responde (horario y espera en segundos), A quién le responde, Límites, Respuestas rápidas (interruptores; las `human_only` con candado) y Avisos. Valida y guarda con `update_agent_settings`. | `config.ts`, `client.ts`, `use-agent-names.ts` |
| `locked-config-form.tsx` | **Capa del proveedor** (solo superadmin): kill switch, identidad y reglas, información del negocio, escalamiento y traspaso, modelo, techos, rango de espera y umbral del aviso mensual. | `client.ts` (`agent_locked_config`) |
| `activity-log.tsx` | Tabla del registro (fecha, agente si hay más de uno, contacto, resultado, motivo, tokens y costo estimado). | `client.ts` |
| `config-section.tsx` | Sección colapsable y la pista de rango «Permitido: x–y». | Los formularios |
| `notes-config-form.tsx` | **Panel del cliente del Asistente de notas**: Nombre, Qué anota, Cuándo anota (minutos de silencio y «También al pasar el chat a una persona»), De quién anota, Límite de pasadas por día y Avisos. | `notes-config.ts`, `client.ts` |
| `notes-backfill.tsx` | «Procesar chats existentes» dentro de la pestaña Proveedor (solo superadmin): avance, iniciar y detener. | `client.ts` |

### Chat y otros

| Archivo | Qué hace | Se conecta con |
|---|---|---|
| `components/inbox/agent-suggestion-banner.tsx` | Banner «Sugerencia del asistente» (Enviar / Editar / Descartar), en vivo por Realtime. | `client.ts`, `/api/agents/suggestions/[id]`, `chat-view.tsx` |
| `components/inbox/agent-pause-toggle.tsx` | Interruptor de pausa en el encabezado del chat; solo aparece si el agente está encendido. | `client.ts` (`set_agent_paused`), `chat-view.tsx` |
| `components/inbox/use-agent-names.ts` | Nombre del asistente (`display_name`) por id para la etiqueta de sus mensajes y notas, con caché por página. | `message-list.tsx`, `notes-panel.tsx`, `contact-summary-card.tsx`, los formularios |
| `components/inbox/notes-panel.tsx` | Notas internas: las del agente con icono de bot y su nombre (cualquiera las borra, nadie las edita); las propias se editan en línea. Monta la tarjeta del resumen arriba (fija). | `contact-summary-card.tsx`, `chat-view.tsx` |
| `components/inbox/contact-summary-card.tsx` | «Resumen del cliente»: texto, contadores, quién lo actualizó y cuándo, y edición en línea (`update_contact_summary`). En vivo por Realtime. | `client.ts` |
| `components/inbox/message-list.tsx` | Muestra la etiqueta con el nombre del asistente en los mensajes con `sent_by_agent`. | `use-agent-names.ts` |
| `components/inbox/chat-view.tsx` | Monta el interruptor y el banner. | Los dos de arriba |
| `components/inbox/inbox.tsx` | `markRead` guarda `conversations.human_seen_at` («una persona abrió el chat»). | Motor (guarda de modo automático) |
| `lib/whatsapp/process-webhook.ts` | Después de guardar un entrante **nuevo**, llama a `scheduleAgentsForInbound` y, con espera 0, a `processDueRuns`. | `engine.ts` |
| `components/quick-replies/quick-reply-dialog.tsx` | Editor de respuestas rápidas; «Cuándo usarla» y «Permiso del agente» solo con `showAgentFields` (superadmin). | `quick-replies-view.tsx`, `config.ts` |
| `components/quick-replies/quick-replies-view.tsx` | Lista de respuestas rápidas; la insignia del permiso del agente solo para superadmin. | `quick-reply-dialog.tsx` |
| `components/crm/app-nav.tsx` | Opción «Agentes» del menú (icono `Bot` de lucide, provisional). | — |
| `components/crm/section-skeletons.tsx` | `AgentsSkeleton`. | `loading.tsx`, `agents-view.tsx` |
| `components/crm/crm-provider.tsx` | `isAdmin` (admin o superadmin) e `isSuperadmin`. | Toda la interfaz |
| `components/settings/users-admin.tsx` y `api/admin/users/route.ts` | Rol «Proveedor» (superadmin): solo otro superadmin lo asigna o lo elimina. | `lib/auth.ts` |
| `lib/auth.ts`, `lib/crm/types.ts` | `requireAdmin` e `isAdminRole` (admin o superadmin); etiquetas de los roles. | API y componentes |
| `lib/env.ts` | `serverEnv` con `OPENAI_API_KEY` y `CRON_SECRET`. | `openai.ts`, `cron-auth.ts` |
| `proxy.ts` | Excluye `api/agents/run` de la sesión (lo protege `CRON_SECRET`). | — |

## 4. Base de datos

**Tablas**

| Objeto | Propósito |
|---|---|
| `agents` | Un registro por agente: `key`, `name`, `enabled`, `mode` (`suggestion`/`automatic`) y `config` (la capa del cliente). Lectura para todos; sin UPDATE directo. |
| `agent_locked_config` | Capa del proveedor, una fila por agente. Solo superadmin. |
| `agent_scheduled_runs` | Respuestas programadas (`pending/running/done/cancelled/skipped`). Como máximo una pendiente por conversación. |
| `agent_usage_log` | Cada decisión del agente: outcome, motivo, tokens reales y costo estimado. Lectura para admin. |
| `agent_suggestions` | Borradores del modo sugerencia. Como máximo uno pendiente por conversación; publicado en Realtime. |
| `contact_summaries` | Resumen del cliente (Asistente de notas): texto, contadores, marca de procesado, quién y cuándo. Lectura para el personal; escritura solo por funciones. Publicado en Realtime. |
| `notes` (columnas) | `agent_id`, `agent_label`, `run_id`, `dedupe_key`, `updated_at`: notas del Asistente de notas. |
| `agents.kind` | `responder` o `notes`. |
| `agent_alerts` | Avisos (`handoff`, `daily_cap`, `monthly_threshold`, `token_cap`, `error`) con su audiencia (admin o superadmin). |
| `conversations` (columnas) | `agent_paused`, `agent_paused_reason`, `agent_consecutive_count` y `human_seen_at`. |
| `messages` (columnas) | `sent_by_agent` y `agent_id`. |
| `quick_replies` (columnas) | `when_to_use` y `agent_permission` (`automatic`/`approval`/`human_only`). Solo los cambia el superadmin. |
| `profiles.role` | Agrega `superadmin`. |

**Vista:** `agent_usage_monthly` (`security_invoker`): uso por agente y mes de Hermosillo.

**Funciones**

| Función | Propósito |
|---|---|
| `private.is_admin()` / `private.is_superadmin()` / `private.require_staff()` | Validación de roles. |
| `public.update_agent_settings` (→ `private.`) | Guarda la capa del cliente: recorta y descarta las claves del proveedor. |
| `public.agent_limits` (→ `private.`) | Rangos para el panel. |
| `public.agent_usage_summary` (→ `private.`) | Uso de hoy y del mes. Ya no lo usa la interfaz. |
| `public.set_agent_paused` (→ `private.`) | Pausar o reanudar un chat; reanudar reinicia el contador. |
| `public.schedule_agent_run` | Programar o posponer (solo `service_role`). |
| `public.claim_agent_runs` | Tomar las corridas vencidas con `FOR UPDATE SKIP LOCKED` (solo `service_role`). |
| `private.agent_cron_tick` | Si hay corridas vencidas, llama a `/api/agents/run` con pg_net y los secretos de Vault. |
| `public.schedule_notes_run` | Pasada de notas: silencio (cada mensaje reinicia, con tope total), traspaso (ya) o lote (no pospone). Solo `service_role`. |
| `public.save_notes_pass` | Guarda notas + resumen + contadores + marca en una transacción, con control de versión (`updated_at`) y sin duplicar notas. Solo `service_role`. |
| `public.update_contact_summary` (→ `private.`) | Edición del resumen por una persona. |
| `public.enqueue_notes_backfill` / `notes_backfill_status` / `cancel_notes_backfill` (→ `private.`) | «Procesar chats existentes» (solo superadmin). |

**Triggers**

| Trigger | Propósito |
|---|---|
| `messages_protect_agent_fields` | Solo el servidor marca `sent_by_agent` y `agent_id`. |
| `messages_agent_outbound` | Un saliente del agente suma al contador; uno de una persona pausa, reinicia el contador y cancela lo pendiente **del Asistente de respuestas** (no las pasadas de notas). |
| `conversations_agent_update` | Asignar el chat lo pausa; pausar cancela la corrida **del Asistente de respuestas**; protege el contador. |
| `agent_locked_validate` | Rangos de espera y tope según el tipo de agente. |
| `notes_touch` | `notes.updated_at` al editar. |
| `agent_locked_touch` | Fecha y autor de los cambios de la capa del proveedor. |
| `quick_replies_protect_agent_fields` | Solo el superadmin cambia el permiso y «cuándo usarla». |
| `profiles_protect_role` | Reglas del rol superadmin y nunca quedarse sin admins. |

**Cron:** el trabajo `agentes-procesar` ejecuta `private.agent_cron_tick()`. Hoy corre cada minuto; la propuesta es pasarlo a cada 10 segundos (SQL abajo).

**Vault:** `agents_runner_url` y `cron_secret`.

### Cambiar el cron a cada 10 segundos (para ejecutar en el SQL Editor)

```sql
select cron.unschedule('agentes-procesar');
select cron.schedule('agentes-procesar', '10 seconds', $$ select private.agent_cron_tick() $$);
-- Comprobar:
select jobid, jobname, schedule, active from cron.job;
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
```

## 5. Variables de entorno

`OPENAI_API_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_APP_SECRET` (las de WhatsApp las usa el envío y el webhook). Aquí solo van los nombres, nunca los valores.

## 6. Flujo de punta a punta

1. **Llega un mensaje.** Meta llama a `/api/whatsapp/webhook`. Se valida la firma, se responde 200 y el resto sigue en `after()` (`webhook/route.ts`).
2. **Se guarda** con `ON CONFLICT DO NOTHING`; los reintentos de Meta no vuelven a programar nada (`process-webhook.ts`).
3. **Se programa:** `scheduleAgentsForInbound` revisa que el agente esté encendido, que no haya kill switch y que el chat no esté pausado, y llama a `schedule_agent_run` con `run_at = ahora + espera en segundos`. Si ya había una corrida pendiente, se pospone (`engine.ts`).
4. **Durante la espera:** si una persona responde, asigna o pausa el chat, los triggers cancelan la corrida. Si la abre, `markRead` guarda `human_seen_at` (`inbox.tsx`).
5. **Tick:** cada 10 s, `agent_cron_tick` ve si hay corridas vencidas y solo entonces llama a `/api/agents/run` con `CRON_SECRET`. Con espera 0, el paso 6 ocurre en el mismo webhook.
6. **Toma de la corrida:** `claim_agent_runs` (`FOR UPDATE SKIP LOCKED`) la pasa a `running`, así dos procesadores nunca responden lo mismo (`engine.ts`).
7. **Guardas** en `executeRun`. Cada una deja su motivo en `agent_usage_log`: encendido → kill switch → pausado → ventana de 24 h → tiene WhatsApp → nadie respondió ya → (automático) nadie abrió el chat → alcance (clasificación y etiquetas) → horario → respuestas seguidas (al llegar, **transfiere**) → tope diario (**bloquea** y avisa) → tope mensual (**bloquea** y avisa al proveedor) → aviso del umbral mensual → tema de escalamiento (**transfiere** sin gastar tokens).
8. **Prompt y modelo:** `buildSystemPrompt` (`prompt.ts`) con la capa del proveedor, el nombre y el tono del cliente y solo las respuestas rápidas que cumplen la regla efectiva; luego `generateReply` (`providers/openai.ts`).
9. **Resultado**, según la herramienta elegida:
   - `responder_texto_corto` o `enviar_respuesta_rapida` → **responde** en automático con `sendAgentText` (`send.ts`) o **sugiere** en modo sugerencia guardando en `agent_suggestions`. Una respuesta rápida «con aprobación» siempre queda como sugerencia.
   - `transferir_a_humano` → **transfiere**: entrega o sugiere el mensaje de traspaso, pausa el chat, asigna si está configurado y avisa (`engine.ts`, `handoff`).
   - Una herramienta no permitida o un error → **error** en el registro (y aviso al proveedor si es un error del modelo).
10. **Sugerencia en el chat:** el banner (`agent-suggestion-banner.tsx`) llama a `/api/agents/suggestions/[id]` para enviar (tal cual o editada) o descartar.
11. **Después:** el trigger `messages_agent_outbound` suma al contador de respuestas seguidas; la burbuja muestra el nombre del asistente (`message-list.tsx`); la corrida se cierra como `done` o `skipped`.

## 7. Qué ve cada rol

| | Agente (persona) | Admin | Superadmin (proveedor) |
|---|---|---|---|
| Lista de agentes en `/agentes` | Sí, sin poder editar | Sí: enciende, apaga y cambia el modo | Sí |
| Tarjetas de uso, avisos y registro de actividad | No | Sí | Sí (además, los avisos de errores y del tope de tokens) |
| Panel «Configurar» → Configuración (cliente) | Lo ve deshabilitado | Edita | Edita |
| Pestaña «Proveedor» (identidad, reglas, negocio, traspaso, modelo, techos, espera mín./máx., umbral, kill switch) | No existe | No existe | Edita |
| «Cuándo usarla» y «Permiso del agente» en respuestas rápidas | No | No | Edita |
| Respuestas `human_only` en el panel | — | Apagadas, con candado y «Solo tu equipo» | Las cambia en el editor de respuestas rápidas |
| Chat: sugerencias, pausa y nombre del asistente | Sí | Sí | Sí |

## 8. Asistente de notas

**Qué hace:** cuando el cliente deja de escribir (o cuando el Asistente de respuestas pasa el chat a una persona), lee SOLO los mensajes nuevos y deja de 0 a 3 notas internas útiles y el resumen del cliente actualizado. Nunca envía nada por WhatsApp y no depende de la pausa del chat.

### Flujo

1. **Llega un mensaje del cliente.** `scheduleAgentsForInbound` llama a `scheduleNotesForInbound` → `schedule_notes_run(…, 'inbound')`: `run_at = ahora + minutos de silencio`. Cada mensaje nuevo reinicia la espera, sin pasar del tope del proveedor (`max_wait_seconds`) desde que se creó la corrida. Una sola pendiente por agente y chat.
2. **Traspaso.** Si el Asistente de respuestas transfiere y el cliente dejó «También al pasar el chat a una persona», `scheduleNotesForHandoff` programa la pasada para ya.
3. **Tick:** el mismo cron cada 10 s y `/api/agents/run`; `processDueRuns` manda la corrida a `executeNotesRun` (de 4 en 4).
4. **Guardas:** encendido → kill switch → alcance → mensajes posteriores a la marca (`contact_summaries.last_processed_at`, máx. `history_window_messages`) → si solo hay saludos o ningún entrante, avanza la marca sin modelo → tope diario de pasadas → tope mensual de tokens (alerta al proveedor) → aviso del umbral del mes.
5. **Modelo:** `buildNotesSystemPrompt` + `buildNotesTurn` (resumen actual, contadores, notas previas del agente y mensajes nuevos sin datos sensibles) → función `registrar_notas`.
6. **Validación del servidor:** `validateNotesPlan` (categorías encendidas, sin datos sensibles, sin repetidas, máximo 3, resumen recortado, contadores que no bajan).
7. **Guardado:** `save_notes_pass` en una transacción. Si una persona editó el resumen durante la pasada → conflicto y reintento en 1 min desde su versión. Si quedan más mensajes que la ventana, se programa el siguiente bloque.
8. **Registro:** `agent_usage_log` (`noted`, `notes_created`, `summary_updated`, tokens y costo).

### Procesar chats existentes

Pestaña Proveedor → «Procesar chats existentes» (solo superadmin, con el agente encendido). La base cuenta los chats con mensajes del cliente posteriores a su marca y los pone en cola cada 20 s. Si se alcanza el tope del día o del mes, la cola se cancela y llega el aviso. Al volver a iniciarlo sigue desde la marca de cada chat; `dedupe_key` impide duplicar notas.

### Pruebas hechas (26/10/2026, sin llamar al modelo)

- **Lógica pura** (transpilada y ejecutada con Node): mensajes por partes completos y marcados como datos; contador acumulado sin notas repetidas; saludos sin notas; resumen editado marcado como base; tarjeta, contraseña y CURP fuera del prompt, de las notas y del resumen; casillas apagadas, máximo 3 y recorte del resumen; configuración recortada.
- **Base** (transacciones revertidas): espera que se reinicia con tope, una pendiente por agente y chat, lote que no pospone y traspaso inmediato; una persona responde → se cancela solo la corrida del Asistente de respuestas; guardado idempotente (la misma nota no se duplica), versión vieja y marca hacia atrás → conflicto; edición humana a mitad de pasada → el agente no la pisa; RLS (no se crean ni editan notas «del agente», sí se borran; sin update directo al resumen); «Procesar chats existentes» rechazado para admin y con el agente apagado; modo Sugerencia rechazado; configuración recortada.
- **Prueba real con el modelo** (`gpt-5-nano`, 26/10/2026; 4 contactos de prueba sin teléfono ni WhatsApp, ya borrados; el motor real se llamó desde una ruta local temporal, ya borrada; el agente siguió apagado en la base). Costo total ≈ US$0.004.
  - (a) 6 mensajes de entrega por partes → 1 nota de entrega completa (dirección, referencia, teléfono, día y hora) + resumen. Hallazgo: salía además una nota solo con el teléfono → se agregó el descarte por contención y una regla fija.
  - (b) 3 preguntas por 15x20x40 → contador ≈ 2–3. Hallazgo: el modelo partía en 3 notas y una decía «400-500 piezas» (el cliente dijo «unas 500») → `mergeSameProduct` y la regla «copia cantidades tal como las dijo». Tras el cambio: 1 nota.
  - (c) «hola», «gracias» → sin notas y sin llamar al modelo.
  - (d) segunda pasada → solo los 2 mensajes nuevos (`handled_messages = 2`), nota «300 blocks de 12x20x40».
  - (e) resumen editado por una persona + «mejor el domingo en la mañana» → Hallazgo: el modelo borraba «llamarle 30 min antes de llegar» → reintento con aviso. Tras el cambio: conserva la indicación y aplica el cambio de día.
  - (f) tarjeta, vencimiento y contraseña → ninguno quedó en notas ni resumen (queda «compartió un dato sensible»). Hallazgo: se colaba el vencimiento «08/29» y salían contadores de «factura» → vencimiento redactado y contadores solo para productos o medidas.
  - Limitación observada: los contadores son aproximados (en (d) no sumó la medida nueva al contador).

